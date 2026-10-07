from dataclasses import dataclass
from typing import List, Dict, Any, Optional, AsyncGenerator, Tuple
from uuid import UUID
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import json
import logging

from app.core.config import get_settings
from app.schemas.api import VapiMessage, OrgConfig, RetrievedKBChunk
from app.prompts.templates import build_system_prompt
from app.tools.executor import ToolExecutor
from app.services.intent_classifier import IntentClassifier

logger = logging.getLogger(__name__)


@dataclass
class BaseMessage:
    content: str


class SystemMessage(BaseMessage):
    pass


class HumanMessage(BaseMessage):
    pass


class AIMessage(BaseMessage):
    pass

# Used when voice_agent_configs.llm_model_escalated is not explicitly set.
# Escalating must never hand a model name from the wrong provider's family
# to that provider's API (e.g. "gpt-4o" to Anthropic), which fails outright.
DEFAULT_ESCALATION_MODEL = {
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-sonnet-20241022",
}

# A resolved tool call: name + complete (already-concatenated) JSON arguments.
ToolCallEvent = Dict[str, str]
# ("text", str) for a chunk of spoken content, or ("tool_call", ToolCallEvent)
# once a tool call has fully arrived. Keeping these as a typed tuple (instead
# of sentinel strings mixed into the text stream) is deliberate: the previous
# design embedded markers like "\n[TOOL_CALL:...]" directly in the character
# stream, which is fragile by construction - two bugs came directly from it,
# see StreamEvent usage below.
StreamEvent = Tuple[str, Any]


class LLMService:
    def __init__(self, db_service, tool_executor: ToolExecutor):
        self.settings = get_settings()
        self.db = db_service
        self.tool_executor = tool_executor
        self.intent_classifier = IntentClassifier()

        # Initialize clients
        self.openai_client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        self.anthropic_client = AsyncAnthropic(api_key=self.settings.anthropic_api_key) if self.settings.anthropic_api_key else None

    def _should_escalate(
        self,
        message: str,
        turn_count: int,
        functions_enabled: Dict[str, bool]
    ) -> bool:
        """Determine if we should escalate to a stronger model"""
        # Check for booking-related keywords
        booking_keywords = ["book", "reschedule", "cancel", "appointment", "schedule", "reserve"]
        message_lower = message.lower()

        if any(keyword in message_lower for keyword in booking_keywords):
            return True

        # Check conversation length
        if turn_count >= self.settings.max_conversation_turns_before_escalation:
            return True

        # Check message length
        if len(message) > self.settings.max_message_length_before_escalation:
            return True

        return False

    def _resolve_model(self, provider: str, base_model: str, escalated_model: Optional[str], should_escalate: bool) -> str:
        """Pick the model for this turn, never crossing an explicit model name
        from one provider's family into another provider's API call."""
        if not should_escalate:
            return base_model
        return escalated_model or DEFAULT_ESCALATION_MODEL.get(provider, base_model)

    async def _stream_openai_response(
        self,
        model: str,
        messages: List[BaseMessage],
        tools: List[Dict[str, Any]],
        temperature: float
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream response from OpenAI: yields ("text", str) chunks as they
        arrive, and ("tool_call", {id, name, arguments}) once each tool call
        has fully arrived (arguments arrive as incremental string fragments
        across many deltas and are not valid JSON until concatenated)."""
        openai_messages = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                openai_messages.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                openai_messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                openai_messages.append({"role": "assistant", "content": msg.content})

        stream = await self.openai_client.chat.completions.create(
            model=model,
            messages=openai_messages,
            tools=tools if tools else None,
            tool_choice="auto" if tools else None,
            temperature=temperature,
            stream=True
        )

        # Keyed by the tool call's index (there can be more than one tool
        # call in a single turn); each entry accumulates its own arguments
        # string across every delta that references that index.
        pending_calls: Dict[int, Dict[str, str]] = {}

        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta.content:
                yield ("text", delta.content)
            if delta.tool_calls:
                for tool_call in delta.tool_calls:
                    entry = pending_calls.setdefault(
                        tool_call.index, {"id": "", "name": "", "arguments": ""}
                    )
                    if tool_call.id:
                        entry["id"] = tool_call.id
                    if tool_call.function and tool_call.function.name:
                        entry["name"] = tool_call.function.name
                    if tool_call.function and tool_call.function.arguments:
                        entry["arguments"] += tool_call.function.arguments

        for entry in pending_calls.values():
            if entry["name"]:
                yield ("tool_call", entry)

    async def _stream_anthropic_response(
        self,
        model: str,
        messages: List[BaseMessage],
        tools: List[Dict[str, Any]],
        temperature: float
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream response from Anthropic: yields ("text", str) chunks as they
        arrive, and ("tool_call", {id, name, arguments}) once each tool call
        has fully arrived (tool inputs arrive as incremental JSON fragments
        per content-block index and are not valid JSON until concatenated)."""
        anthropic_messages = []
        system_content = ""

        for msg in messages:
            if isinstance(msg, SystemMessage):
                system_content = msg.content
            elif isinstance(msg, HumanMessage):
                anthropic_messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                anthropic_messages.append({"role": "assistant", "content": msg.content})

        # Convert tools to Anthropic format
        anthropic_tools = []
        for tool in tools:
            if tool.get("type") == "function":
                fn = tool["function"]
                anthropic_tools.append({
                    "name": fn["name"],
                    "description": fn.get("description", ""),
                    "input_schema": fn.get("parameters", {})
                })

        stream = await self.anthropic_client.messages.create(
            model=model,
            messages=anthropic_messages,
            system=system_content,
            tools=anthropic_tools if anthropic_tools else None,
            temperature=temperature,
            max_tokens=4096,
            stream=True
        )

        # Keyed by content-block index, mirroring the OpenAI accumulator above.
        pending_calls: Dict[int, Dict[str, str]] = {}

        async for chunk in stream:
            if chunk.type == "content_block_start" and chunk.content_block.type == "tool_use":
                pending_calls[chunk.index] = {
                    "id": chunk.content_block.id,
                    "name": chunk.content_block.name,
                    "arguments": "",
                }
            elif chunk.type == "content_block_delta":
                if chunk.delta.type == "text_delta":
                    yield ("text", chunk.delta.text)
                elif chunk.delta.type == "input_json_delta" and chunk.index in pending_calls:
                    pending_calls[chunk.index]["arguments"] += chunk.delta.partial_json

        for entry in pending_calls.values():
            if not entry["arguments"]:
                entry["arguments"] = "{}"
            yield ("tool_call", entry)

    def _build_tool_definitions(self, available_tools: List[str]) -> List[Dict[str, Any]]:
        """Build OpenAI-compatible tool definitions"""
        tool_defs = {
            "check_availability": {
                "type": "function",
                "function": {
                    "name": "check_availability",
                    "description": (
                        "Look up real open appointment slots near a time the caller asked about. "
                        "Call this before book_appointment so you can offer the caller a real, "
                        "bookable time rather than guessing."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "requested_time": {
                                "type": "string",
                                "description": (
                                    "The date/time the caller is interested in, resolved to an exact "
                                    "ISO 8601 timestamp (e.g. 2026-09-08T15:00:00) using the current "
                                    "date and timezone given above. If the caller gave no specific "
                                    "time, use the current date."
                                ),
                            },
                            "service": {
                                "type": "string",
                                "description": "What the caller wants booked.",
                            },
                        },
                        "required": ["requested_time"]
                    }
                }
            },
            "book_appointment": {
                "type": "function",
                "function": {
                    "name": "book_appointment",
                    "description": (
                        "Book an appointment for the caller at an exact time you already confirmed "
                        "is open via check_availability. Always get the caller's name and a real "
                        "email address first - Calendly emails the confirmation and calendar invite to it."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "customer_name": {"type": "string", "description": "The caller's full name."},
                            "customer_email": {
                                "type": "string",
                                "description": "The caller's email address, for the confirmation and calendar invite.",
                            },
                            "customer_phone": {
                                "type": "string",
                                "description": "The caller's phone number, for an SMS reminder if available.",
                            },
                            "requested_time": {
                                "type": "string",
                                "description": "The exact slot to book, as an ISO 8601 timestamp matching one returned by check_availability.",
                            },
                            "service": {"type": "string", "description": "What the caller wants booked."},
                        },
                        "required": ["customer_name", "customer_email", "requested_time"]
                    }
                }
            },
            "transfer_call": {
                "type": "function",
                "function": {
                    "name": "transfer_call",
                    "description": "Transfer the call to a human operator",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "phone_number": {"type": "string"},
                            "reason": {"type": "string"}
                        },
                        "required": ["phone_number"]
                    }
                }
            },
            "take_message": {
                "type": "function",
                "function": {
                    "name": "take_message",
                    "description": "Take a message for the business",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "summary": {"type": "string"},
                            "customer_name": {"type": "string"},
                            "customer_phone": {"type": "string"},
                            "callback_requested": {"type": "boolean", "default": False}
                        },
                        "required": ["summary"]
                    }
                }
            }
        }

        return [tool_defs[name] for name in available_tools if name in tool_defs]

    async def generate_response(
        self,
        org_config: OrgConfig,
        conversation_id: UUID,
        vapi_call_id: Optional[str],
        is_sandbox: bool,
        retrieved_chunks: List[RetrievedKBChunk],
        message_history: List[VapiMessage],
        current_user_message: str
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response with tool calling support"""

        voice_config = org_config.voice_agent_config
        org_id = org_config.org_id
        tz_name = org_config.timezone or "UTC"
        available_tools = self.tool_executor.get_available_tools(voice_config.functions_enabled)
        tool_definitions = self._build_tool_definitions(available_tools)

        # Determine which model to use
        turn_count = len(message_history)
        should_escalate = self._should_escalate(
            current_user_message,
            turn_count,
            voice_config.functions_enabled
        )

        provider = voice_config.llm_provider
        model = self._resolve_model(
            provider, voice_config.llm_model, voice_config.llm_model_escalated, should_escalate
        )

        logger.info(f"Using model: {model} (provider: {provider}, escalated: {should_escalate})")

        # Build system prompt
        system_prompt = build_system_prompt(org_config, retrieved_chunks, available_tools)

        # Prepare messages: system + history + current user message
        messages = [SystemMessage(content=system_prompt)]

        # Add conversation history (excluding the current message which we'll add separately)
        for msg in message_history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content or ""))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content or ""))
            elif msg.role == "system":
                # Skip additional system messages
                pass

        # Add current user message
        messages.append(HumanMessage(content=current_user_message))

        # Stream response
        full_response = ""
        resolved_tool_calls: List[ToolCallEvent] = []

        if provider == "anthropic" and self.anthropic_client:
            stream = self._stream_anthropic_response(model, messages, tool_definitions, voice_config.temperature)
        else:
            stream = self._stream_openai_response(model, messages, tool_definitions, voice_config.temperature)

        async for kind, payload in stream:
            if kind == "text":
                full_response += payload
                yield payload
            elif kind == "tool_call":
                resolved_tool_calls.append(payload)

        # Handle tool calls, now that each one has fully arrived with valid JSON arguments
        for tool_call_data in resolved_tool_calls:
            try:
                arguments = json.loads(tool_call_data["arguments"]) if tool_call_data["arguments"] else {}
                tool_result = await self.tool_executor.execute_tool(
                    tool_name=tool_call_data["name"],
                    arguments=arguments,
                    escalation_number=voice_config.escalation_number,
                    conversation_id=conversation_id,
                    org_id=org_id,
                    tz_name=tz_name,
                )

                # If tool result indicates fallback to take_message, execute it
                if tool_result.get("fallback_to_take_message"):
                    # Extract summary from the conversation for take_message
                    fallback_result = await self.tool_executor.execute_tool(
                        tool_name="take_message",
                        arguments={
                            "summary": f"Customer inquired about booking. AI response: {full_response[:500]}",
                            "callback_requested": True
                        },
                        conversation_id=conversation_id
                    )
                    yield f"\n{fallback_result.get('confirmation', 'Message taken.')}"
                elif tool_result.get("success"):
                    # For transfer_call, yield special Vapi response format
                    if tool_result.get("transfer"):
                        yield f"\n[TRANSFER:{json.dumps(tool_result['transfer'])}]"
                    else:
                        yield f"\n{tool_result.get('confirmation', 'Done.')}"
                else:
                    yield f"\n{tool_result.get('error', 'Tool execution failed.')}"
            except Exception as e:
                logger.error(f"Error executing tool: {e}")
                yield f"\nError executing tool: {str(e)}"
    
    async def classify_with_llm(
        self,
        prompt: str,
        org_config: OrgConfig,
        json_mode: bool = False
    ) -> str:
        """
        Simple LLM call for classification/extraction tasks
        Used by orchestration service for intent classification, entity extraction, etc.
        """
        try:
            provider = org_config.voice_agent_config.llm_provider
            model = org_config.voice_agent_config.llm_model
            
            if provider == "anthropic" and self.anthropic_client:
                response = await self.anthropic_client.messages.create(
                    model=model,
                    max_tokens=500,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
            else:
                response = await self.openai_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=500,
                )
                return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error in classify_with_llm: {e}")
            return ""
    
    async def get_intent_classification(self, message: str) -> Dict[str, Any]:
        """Get intent classification using the intent classifier"""
        return await self.intent_classifier.classify_intent(message)
    
    async def get_sentiment_analysis(self, messages: List[str]) -> Dict[str, Any]:
        """Analyze sentiment trend across messages"""
        return await self.intent_classifier.detect_sentiment_trend(messages)
    
    async def extract_entities(self, message: str) -> Dict[str, Any]:
        """Extract entities from message"""
        return await self.intent_classifier.extract_entities(message)
