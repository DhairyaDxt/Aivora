# LangGraph Orchestration Implementation Guide

## Overview

Aivora now uses **LangGraph** for multi-agent agentic AI orchestration. Instead of a linear prompt-and-respond flow, the AI now makes structured decisions about what to do next at each conversation turn.

## Architecture

### State Machine Flow

```
START
  ↓
classify_intent
  ↓ (routes based on intent)
  ├→ kb_answer → search_kb → generate_response → END
  ├→ book_appointment → check_availability → [conditional] → execute_tools/escalate
  ├→ escalate → escalate → END
  └→ take_message → generate_response → END
```

### Key Components

#### 1. **ConversationState**
The state object that flows through the graph, containing:
- `messages`: Conversation history as LangChain BaseMessage objects
- `org_id`, `service_id`, `conversation_id`: Identifiers
- `org_config`: Business configuration
- `retrieved_chunks`: KB search results
- `intent`: Classified user intent
- `tools_executed`: List of tools called
- `response`: Generated AI response
- `should_transfer`: Flag for human escalation

#### 2. **Intent Classification** (`IntentClassifier`)
Uses HuggingFace zero-shot classification to detect:
- **Primary intent**: booking, information, complaint, escalation
- **Confidence score**: How sure the model is
- **Sentiment**: POSITIVE, NEGATIVE, NEUTRAL
- **Urgency flags**: Automatically escalates if negative + urgency keywords

```python
from app.services.intent_classifier import IntentClassifier

classifier = IntentClassifier()
result = await classifier.classify_intent("I want to book an appointment tomorrow")
# Returns: {
#   "primary_intent": "booking an appointment",
#   "confidence": 0.92,
#   "sentiment": "POSITIVE",
#   "requires_urgency_escalation": False
# }
```

#### 3. **Graph Nodes**

##### `classify_intent`
- Determines what the customer wants
- Uses zero-shot classification for flexibility
- Routes to appropriate handler

##### `search_kb`
- Semantic search over knowledge base
- Already done in API layer, logged here

##### `check_availability`
- Extracts booking details (date, time, service)
- Checks Calendly for open slots
- Routes to booking or escalation

##### `execute_tools`
- Calls Calendly, Twilio, or other integrations
- Handles booking confirmation
- Falls back to `take_message` if booking fails

##### `generate_response`
- Creates natural language response
- Uses system prompt with KB context
- Streaming response generation

##### `escalate`
- Routes to human agent
- Logs escalation reason
- Preserves conversation context

#### 4. **Entity Extraction**
Automatically extracts from messages:
- Email addresses and phone numbers
- Requested dates/times
- Service types
- Customer names

```python
entities = await classifier.extract_entities(
    "Hi, I'm John Smith, call me at 555-1234, I want a haircut tomorrow at 2pm"
)
# Returns:
# {
#   "names": ["John Smith"],
#   "contact_info": ["555-1234"],
#   "services": ["haircut"],
#   "times": ["tomorrow", "2pm"]
# }
```

#### 5. **Sentiment Analysis with Escalation**
Tracks sentiment across conversation:

```python
sentiment = await llm_service.get_sentiment_analysis([
    "Hi, I'd like to book an appointment",  # POSITIVE
    "Wait, that time doesn't work",          # NEUTRAL
    "This is really frustrating!",           # NEGATIVE
])
# If 50%+ are NEGATIVE → auto-escalate
```

## Usage

### In the API Route

Instead of calling `llm_service.generate_response()` directly:

```python
# Old approach (linear)
async for chunk in llm_service.generate_response(...):
    yield chunk

# New approach (agentic with LangGraph)
from app.services.orchestration_service import OrchestrationService

orchestrator = OrchestrationService(db_service, tool_executor, llm_service)

result = await orchestrator.process_turn(
    org_id=org_id,
    service_id=service_id,
    conversation_id=conversation.id,
    org_config=org_config,
    retrieved_chunks=retrieved_chunks,
    message_history=history_messages,
    current_user_message=current_user_message
)

# Result contains:
# - response: The AI's reply
# - intent: What the AI decided to do
# - should_transfer: True if escalating
# - transfer_data: Phone number, reason, etc.
```

## Key AI/ML Features

### 1. **Multi-Agent Decision Making**
- Not just "respond to anything"
- Explicitly decides: answer, book, escalate, or take message
- Each decision is logged for analysis

### 2. **Intent Classification (Zero-Shot)**
- No fine-tuning required
- Works with new intents immediately
- Supports multi-class classification

### 3. **Sentiment Tracking**
- Detects frustrated customers
- Auto-escalates if negative trend
- Prevents repeated frustration cycles

### 4. **Entity Extraction**
- Captures booking details without explicit prompts
- Extracts contact info automatically
- Fills in tool parameters intelligently

### 5. **Conditional Routing**
- Graph conditionally routes based on context
- Prevents infinite loops (max tool calls)
- Graceful fallbacks (booking fails → take message)

## Implementation Checklist

- [x] Add LangGraph + LangChain to requirements.txt
- [x] Create `OrchestrationService` with state machine
- [x] Create `IntentClassifier` with transformers
- [x] Add entity extraction
- [x] Add sentiment analysis
- [x] Integrate with LLMService
- [ ] Update `/v1/chat/completions` API to use orchestrator
- [ ] Add orchestration metrics (intent distribution, escalation rate)
- [ ] Add dashboard visualization of conversation flow
- [ ] Test end-to-end with voice and WhatsApp

## Next Steps to Connect

### Update `/v1/chat/completions` endpoint:

```python
@router.post("/v1/chat/completions")
async def chat_completions(
    request: VapiChatCompletionRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    db_service: DatabaseService = Depends(get_db_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    llm_service: LLMService = Depends(get_llm_service),
    orchestrator: OrchestrationService = Depends(get_orchestration_service)  # NEW
):
    # ... existing code ...
    
    # NEW: Use orchestrator instead of direct llm_service.generate_response
    result = await orchestrator.process_turn(
        org_id=org_id,
        service_id=service_id,
        conversation_id=conversation.id,
        org_config=org_config,
        retrieved_chunks=retrieved_chunks,
        message_history=history_messages,
        current_user_message=current_user_message
    )
    
    # Emit response and handle escalation
    async def generate():
        yield f"data: {json.dumps(chunk)}\n\n"
        
        if result["should_transfer"]:
            # Special handling for transfer
            transfer_chunk = {
                "choices": [{
                    "delta": {"content": f"\n[TRANSFER:{json.dumps(result['transfer_data'])}]"}
                }]
            }
            yield f"data: {json.dumps(transfer_chunk)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

### Add Logging & Metrics

```python
# Log orchestration decisions for analysis
await db_service.log_orchestration_decision(
    conversation_id=conversation.id,
    intent=result["intent"],
    confidence=result.get("confidence", 0),
    tools_executed=result.get("tools_executed", []),
    escalation=result["should_transfer"]
)
```

## Benefits Over Linear LLM

| Aspect | Linear LLM | LangGraph |
|--------|-----------|-----------|
| **Decision Making** | Implicit in prompt | Explicit state machine |
| **Intent Clarity** | Buried in generation | First-class node |
| **Error Handling** | Retry prompt | Graph routing + fallbacks |
| **Interpretability** | Black box | Clear decision trail |
| **Scalability** | Add to prompt | Add new node + edges |
| **Metrics** | Hard to extract | Every decision logged |

## Debugging

### Trace a conversation's orchestration path:

```python
# Check what intents were classified
from app.services.orchestration_service import ConversationState

messages = await db.get_conversation_messages(conversation_id)
for msg in messages:
    if msg.metadata and "intent" in msg.metadata:
        print(f"Intent: {msg.metadata['intent']}, Confidence: {msg.metadata['confidence']}")
```

### Monitor escalation patterns:

```sql
-- Which intents lead to escalation most often?
SELECT intent, COUNT(*) as escalations
FROM orchestration_logs
WHERE should_transfer = true
GROUP BY intent
ORDER BY escalations DESC;
```

## References

- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [LangChain BaseMessage](https://api.python.langchain.com/en/latest/schema/langchain_core.messages.base_message.BaseMessage.html)
- [HuggingFace Transformers](https://huggingface.co/docs/transformers/)
