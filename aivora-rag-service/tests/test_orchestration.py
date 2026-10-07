"""
Tests for LangGraph orchestration service and intent classification

These tests demonstrate the agentic AI capabilities of Aivora.
"""

import pytest
import asyncio
from uuid import uuid4

from app.services.intent_classifier import IntentClassifier
from app.services.orchestration_service import ConversationState


@pytest.mark.asyncio
class TestIntentClassification:
    """Test intent classification with various customer messages"""
    
    @pytest.fixture
    def classifier(self):
        return IntentClassifier()
    
    @pytest.mark.asyncio
    async def test_classify_booking_intent(self, classifier):
        """Test detection of booking intent"""
        message = "I'd like to book an appointment tomorrow at 2pm for a haircut"
        result = await classifier.classify_intent(message)
        
        assert result["primary_intent"] == "booking an appointment"
        assert result["confidence"] > 0.7
        assert result["sentiment"] == "POSITIVE"
        assert not result["requires_urgency_escalation"]
    
    @pytest.mark.asyncio
    async def test_classify_information_intent(self, classifier):
        """Test detection of information-seeking intent"""
        message = "What are your business hours and services?"
        result = await classifier.classify_intent(message)
        
        assert result["primary_intent"] == "asking for information"
        assert result["confidence"] > 0.7
        assert not result["requires_urgency_escalation"]
    
    @pytest.mark.asyncio
    async def test_classify_cancellation_intent(self, classifier):
        """Test detection of cancellation intent"""
        message = "I need to cancel my appointment next week"
        result = await classifier.classify_intent(message)
        
        assert result["primary_intent"] == "cancelling an appointment"
        assert result["confidence"] > 0.7
    
    @pytest.mark.asyncio
    async def test_urgent_complaint_detection(self, classifier):
        """Test escalation signal for urgent negative sentiment"""
        message = "This is absolutely terrible! I've been waiting forever and I'm really angry!"
        result = await classifier.classify_intent(message)
        
        assert result["sentiment"] == "NEGATIVE"
        assert result["urgency_indicators_found"]
        assert result["requires_urgency_escalation"]  # Should flag for escalation
    
    @pytest.mark.asyncio
    async def test_entity_extraction(self, classifier):
        """Test extraction of useful information from message"""
        message = (
            "Hi, my name is John Smith, you can reach me at john@email.com "
            "or 555-123-4567. I'd like to schedule a massage for tomorrow afternoon."
        )
        entities = await classifier.extract_entities(message)
        
        assert "john@email.com" in entities["contact_info"]
        assert any("555-123-4567" in str(phone) for phone in entities["contact_info"])
        assert "massage" in entities["services"]
        assert any("afternoon" in time.lower() for time in entities["times"])
    
    @pytest.mark.asyncio
    async def test_sentiment_trend_analysis(self, classifier):
        """Test sentiment analysis across multiple messages"""
        messages = [
            "Hi, I'd like to book an appointment.",           # POSITIVE
            "Can you tell me your available times?",          # NEUTRAL
            "None of those times work for me...",             # NEGATIVE
            "Actually, can we try next week instead?",        # NEUTRAL
        ]
        
        result = await classifier.detect_sentiment_trend(messages)
        
        assert result["messages_analyzed"] == 4
        assert result["trend"] in ["declining", "improving", "mixed"]
        # With 1 positive, 2 negative, 1 neutral → should show decline trend
        assert result["negative_percentage"] > 30  # At least some negatives detected


@pytest.mark.asyncio
class TestConversationStateManagement:
    """Test ConversationState data structure"""
    
    def test_state_initialization(self):
        """Test creating a conversation state"""
        state = ConversationState(
            org_id=uuid4(),
            service_id=uuid4(),
            conversation_id=uuid4(),
            intent="kb_answer"
        )
        
        assert state.org_id is not None
        assert state.intent == "kb_answer"
        assert state.messages == []
        assert state.tools_executed == []
        assert not state.should_transfer
    
    def test_state_immutability_via_dataclass(self):
        """Test that state fields can be updated (mutable dataclass)"""
        state = ConversationState(intent="unknown")
        
        # Should be able to update
        state.intent = "kb_answer"
        assert state.intent == "kb_answer"
        
        # Should be able to append to lists
        state.tools_executed.append("check_availability")
        assert "check_availability" in state.tools_executed


class TestOrchestrationExamples:
    """Example scenarios for orchestration"""
    
    @pytest.mark.asyncio
    async def test_booking_flow_scenario(self):
        """
        Scenario: Customer wants to book an appointment
        
        Expected flow:
        1. Intent classified as "booking"
        2. Route to check_availability
        3. Extract date/time/service
        4. Execute booking tool
        5. Generate confirmation response
        """
        classifier = IntentClassifier()
        
        # Turn 1: Customer initiates booking
        msg1 = "I'd like to schedule a massage for tomorrow at 3pm"
        intent1 = await classifier.classify_intent(msg1)
        entities1 = await classifier.extract_entities(msg1)
        
        assert intent1["primary_intent"] == "booking an appointment"
        assert "massage" in entities1["services"]
        assert "tomorrow" in entities1["times"]
        
        # Graph would route: classify_intent → check_availability → execute_tools → generate_response
    
    @pytest.mark.asyncio
    async def test_escalation_scenario(self):
        """
        Scenario: Customer is frustrated and needs help
        
        Expected flow:
        1. Sentiment detected as NEGATIVE + urgency
        2. Intent classified + escalation flag set
        3. Route to escalate node
        4. Transfer to human
        """
        classifier = IntentClassifier()
        
        # Multiple frustrated messages
        messages = [
            "I can't log into my account!",                    # NEGATIVE
            "This is ridiculous, I've tried 5 times!",         # NEGATIVE + urgent
            "I need help NOW, this is unacceptable!"           # NEGATIVE + urgent
        ]
        
        trend = await classifier.detect_sentiment_trend(messages)
        
        # Should detect declining/negative trend
        assert trend["should_escalate"]
        assert trend["negative_percentage"] > 50
        
        # Graph would route: classify_intent → escalate → transfer_to_human
    
    @pytest.mark.asyncio
    async def test_kb_answer_scenario(self):
        """
        Scenario: Customer asks for information
        
        Expected flow:
        1. Intent classified as "asking for information"
        2. Route to search_kb
        3. Retrieve relevant chunks
        4. Generate response with context
        """
        classifier = IntentClassifier()
        
        msg = "What are your business hours and do you offer evening appointments?"
        intent = await classifier.classify_intent(msg)
        
        assert intent["primary_intent"] == "asking for information"
        assert intent["sentiment"] == "POSITIVE"
        
        # Graph would route: classify_intent → search_kb → generate_response


# Integration test example (would need mocked services)
class TestOrchestrationIntegration:
    """Integration tests with full orchestrator"""
    
    @pytest.mark.asyncio
    async def test_full_orchestration_pipeline(self):
        """
        Full end-to-end test with orchestrator
        
        Note: This is a template. In actual tests, you'd mock:
        - DatabaseService
        - ToolExecutor
        - LLMService
        """
        pytest.skip("Requires mocked dependencies - implement with fixtures")
        
        # from app.services.orchestration_service import OrchestrationService
        # from unittest.mock import AsyncMock, MagicMock
        
        # db_mock = MagicMock()
        # tool_executor_mock = MagicMock()
        # llm_service_mock = MagicMock()
        
        # orchestrator = OrchestrationService(
        #     db_mock,
        #     tool_executor_mock,
        #     llm_service_mock
        # )
        
        # result = await orchestrator.process_turn(
        #     org_id=uuid4(),
        #     service_id=uuid4(),
        #     conversation_id=uuid4(),
        #     org_config=mock_config,
        #     retrieved_chunks=[],
        #     message_history=[],
        #     current_user_message="I want to book an appointment tomorrow"
        # )
        
        # assert result["intent"] == "book_appointment"
        # assert result["response"] is not None


if __name__ == "__main__":
    # Run with: pytest tests/test_orchestration.py -v
    pytest.main([__file__, "-v", "-s"])
