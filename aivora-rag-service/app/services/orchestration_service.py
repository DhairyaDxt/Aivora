"""
LangGraph-based AI Orchestration Service

This module implements a state machine that decides what action to take
on each conversation turn: answer from KB, check availability, book,
escalate, or take a message.
"""

import json
import logging
from typing import Dict, List, Any, Optional, Annotated
from dataclasses import dataclass, field
from uuid import UUID
from datetime import datetime

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool

from app.schemas.api import OrgConfig, RetrievedKBChunk
from app.tools.executor import ToolExecutor
from app.prompts.templates import build_system_prompt

logger = logging.getLogger(__name__)


@dataclass
class ConversationState:
    """State object passed through the LangGraph state machine"""
    # Core conversation data
    messages: Annotated[List[BaseMessage], add_messages] = field(default_factory=list)
    
    # Metadata
    org_id: UUID = None
    service_id: UUID = None
    conversation_id: UUID = None
    org_config: OrgConfig = None
    retrieved_chunks: List[RetrievedKBChunk] = field(default_factory=list)
    
    # Decision tracking
    intent: str = ""  # kb_answer, book_appointment, escalate, take_message
    tools_executed: List[str] = field(default_factory=list)
    escalation_reason: str = ""
    
    # Output
    response: str = ""
    should_transfer: bool = False
    transfer_data: Dict[str, Any] = None


class OrchestrationService:
    """LangGraph-based multi-agent orchestrator for Aivora"""
    
    def __init__(self, db_service, tool_executor: ToolExecutor, llm_service):
        self.db = db_service
        self.tool_executor = tool_executor
        self.llm_service = llm_service
        
        # Build the graph
        self.graph = self._build_graph()
    
    def _build_graph(self):
        """Build the LangGraph state machine"""
        workflow = StateGraph(ConversationState)
        
        # Add nodes
        workflow.add_node("classify_intent", self._classify_intent)
        workflow.add_node("search_kb", self._search_kb)
        workflow.add_node("check_availability", self._check_availability)
        workflow.add_node("generate_response", self._generate_response)
        workflow.add_node("execute_tools", self._execute_tools)
        workflow.add_node("escalate", self._escalate)
        
        # Set entry point
        workflow.add_edge(START, "classify_intent")
        
        # Conditional routing from classify_intent
        workflow.add_conditional_edges(
            "classify_intent",
            self._route_after_classify,
            {
                "kb_answer": "search_kb",
                "book_appointment": "check_availability",
                "escalate": "escalate",
                "take_message": "generate_response",
                "default": "generate_response"
            }
        )
        
        # After KB search, generate response
        workflow.add_edge("search_kb", "generate_response")
        
        # After availability check, execute booking if confirmed
        workflow.add_conditional_edges(
            "check_availability",
            self._route_after_availability,
            {
                "proceed_booking": "execute_tools",
                "escalate": "escalate",
                "user_confirmed": "generate_response"
            }
        )
        
        # Tool execution flows
        workflow.add_conditional_edges(
            "execute_tools",
            self._route_after_tools,
            {
                "success": "generate_response",
                "escalate": "escalate",
                "retry": "generate_response"
            }
        )
        
        # Response generation leads to end
        workflow.add_edge("generate_response", END)
        workflow.add_edge("escalate", END)
        
        return workflow.compile()
    
    async def process_turn(
        self,
        org_id: UUID,
        service_id: UUID,
        conversation_id: UUID,
        org_config: OrgConfig,
        retrieved_chunks: List[RetrievedKBChunk],
        message_history: List[Dict[str, str]],
        current_user_message: str
    ) -> Dict[str, Any]:
        """
        Process one conversation turn through the LangGraph orchestrator
        
        Returns: {
            "response": str,
            "intent": str,
            "should_transfer": bool,
            "transfer_data": dict (if should_transfer)
        }
        """
        
        # Convert message history to BaseMessage objects
        messages = []
        for msg in message_history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        
        # Add current user message
        messages.append(HumanMessage(content=current_user_message))
        
        # Initialize state
        state = ConversationState(
            messages=messages,
            org_id=org_id,
            service_id=service_id,
            conversation_id=conversation_id,
            org_config=org_config,
            retrieved_chunks=retrieved_chunks
        )
        
        # Run through the graph
        final_state = self.graph.invoke(state)
        
        return {
            "response": final_state.response,
            "intent": final_state.intent,
            "should_transfer": final_state.should_transfer,
            "transfer_data": final_state.transfer_data
        }
    
    # ========== Node implementations ==========
    
    async def _classify_intent(self, state: ConversationState) -> ConversationState:
        """
        Classify the user's intent: 
        kb_answer, book_appointment, escalate, take_message
        """
        latest_message = state.messages[-1].content if state.messages else ""
        
        intent_prompt = f"""
Based on this customer message, classify their intent:

Message: "{latest_message}"

Intent categories:
- "kb_answer": Customer asking for information that can be answered from knowledge base
- "book_appointment": Customer wants to schedule/book an appointment
- "escalate": Customer is frustrated, urgent, or needs human help
- "take_message": Customer wants to leave a message
- "default": Unclear or small talk

Respond with ONLY the intent category (one word), no explanation.
        """
        
        # Use LLM to classify
        classification = await self.llm_service.classify_with_llm(
            prompt=intent_prompt,
            org_config=state.org_config
        )
        
        state.intent = classification.strip().lower()
        logger.info(f"Intent classified as: {state.intent}")
        
        return state
    
    async def _search_kb(self, state: ConversationState) -> ConversationState:
        """
        Search knowledge base for relevant chunks
        (Already done before reaching graph, but here for completeness)
        """
        # Chunks already retrieved, just log
        logger.info(f"KB Search: Found {len(state.retrieved_chunks)} relevant chunks")
        return state
    
    async def _check_availability(self, state: ConversationState) -> ConversationState:
        """Check availability for booking intent"""
        latest_message = state.messages[-1].content if state.messages else ""
        
        # Extract requested time and service from message
        extraction_prompt = f"""
Extract the requested appointment time and service from this message.
Message: "{latest_message}"

Respond with JSON: {{"requested_time": "ISO 8601 or relative", "service": "service name"}}
        """
        
        extracted = await self.llm_service.classify_with_llm(
            prompt=extraction_prompt,
            org_config=state.org_config,
            json_mode=True
        )
        
        try:
            extracted_data = json.loads(extracted)
            # Store for later use in execute_tools
            state.messages[-1].metadata = state.messages[-1].metadata or {}
            state.messages[-1].metadata["booking_request"] = extracted_data
        except:
            logger.warning("Could not parse booking extraction")
        
        return state
    
    async def _generate_response(self, state: ConversationState) -> ConversationState:
        """
        Generate AI response based on intent and context
        """
        system_prompt = build_system_prompt(
            state.org_config, 
            state.retrieved_chunks,
            self.tool_executor.get_available_tools(state.org_config.voice_agent_config.functions_enabled)
        )
        
        # Build messages for LLM
        messages = [SystemMessage(content=system_prompt)]
        messages.extend(state.messages)
        
        # Get streaming response
        response_text = ""
        async for chunk in self.llm_service._stream_openai_response(
            model=state.org_config.voice_agent_config.llm_model,
            messages=messages,
            tools=[],
            temperature=state.org_config.voice_agent_config.temperature
        ):
            if chunk[0] == "text":
                response_text += chunk[1]
        
        state.response = response_text
        state.messages.append(AIMessage(content=response_text))
        
        return state
    
    async def _execute_tools(self, state: ConversationState) -> ConversationState:
        """
        Execute tools based on intent (check_availability, book_appointment, etc.)
        """
        if state.intent == "book_appointment":
            # Extract booking details from previous analysis
            booking_data = state.messages[-2].metadata.get("booking_request", {}) if len(state.messages) > 1 else {}
            
            tool_result = await self.tool_executor.execute_tool(
                tool_name="book_appointment",
                arguments=booking_data,
                escalation_number=state.org_config.voice_agent_config.escalation_number,
                conversation_id=state.conversation_id,
                org_id=state.org_id,
                tz_name=state.org_config.timezone or "UTC"
            )
            
            state.tools_executed.append("book_appointment")
            
            if not tool_result.get("success"):
                # Fallback to take_message
                state.intent = "take_message"
                state.escalation_reason = tool_result.get("error", "Booking failed")
        
        return state
    
    async def _escalate(self, state: ConversationState) -> ConversationState:
        """
        Handle escalation to human agent
        """
        escalation_config = state.org_config.voice_agent_config
        
        state.should_transfer = True
        state.transfer_data = {
            "phone_number": escalation_config.escalation_number,
            "reason": state.escalation_reason or f"Intent: {state.intent}",
            "conversation_id": str(state.conversation_id)
        }
        
        logger.info(f"Escalating conversation {state.conversation_id} to human")
        
        return state
    
    # ========== Routing functions ==========
    
    def _route_after_classify(self, state: ConversationState) -> str:
        """Route based on classified intent"""
        intent_map = {
            "kb_answer": "kb_answer",
            "book_appointment": "book_appointment",
            "escalate": "escalate",
            "take_message": "take_message"
        }
        return intent_map.get(state.intent, "default")
    
    def _route_after_availability(self, state: ConversationState) -> str:
        """Route after checking availability"""
        # If slots found, proceed; if not, escalate
        return "user_confirmed"  # Simplified for now
    
    def _route_after_tools(self, state: ConversationState) -> str:
        """Route after tool execution"""
        # Check if tools succeeded; if not, escalate
        return "success"  # Simplified for now
