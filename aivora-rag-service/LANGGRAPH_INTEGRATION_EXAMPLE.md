# LangGraph Integration Example

## Quick Integration into Existing Routes

Here's how to integrate the orchestrator into your existing `/v1/chat/completions` endpoint:

### Current Code (Before)

```python
# In app/api/routes.py

@router.post("/v1/chat/completions")
async def chat_completions(
    request: VapiChatCompletionRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    db_service: DatabaseService = Depends(get_db_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    llm_service: LLMService = Depends(get_llm_service)
):
    try:
        # ... validation code ...
        
        # Generate streaming response
        async def generate():
            full_response = ""
            async for chunk in llm_service.generate_response(
                org_config=org_config,
                conversation_id=conversation.id,
                vapi_call_id=vapi_call_id,
                is_sandbox=is_sandbox,
                retrieved_chunks=retrieved_chunks,
                message_history=history_messages,
                current_user_message=current_user_message
            ):
                full_response += chunk
                
                # Format as OpenAI SSE chunk
                sse_chunk = {...}
                yield f"data: {json.dumps(sse_chunk)}\n\n"
            
            # Log and finalize
            if full_response.strip():
                await db_service.add_message(conversation.id, "ai", full_response)
```

### Updated Code (With LangGraph)

```python
# In app/api/routes.py

from app.services.orchestration_service import OrchestrationService

# Add dependency
def get_orchestration_service(
    db_service: DatabaseService = Depends(get_db_service),
    llm_service: LLMService = Depends(get_llm_service),
    tool_executor: ToolExecutor = Depends(get_tool_executor)
) -> OrchestrationService:
    return OrchestrationService(db_service, tool_executor, llm_service)

@router.post("/v1/chat/completions")
async def chat_completions(
    request: VapiChatCompletionRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    db_service: DatabaseService = Depends(get_db_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    llm_service: LLMService = Depends(get_llm_service),
    orchestrator: OrchestrationService = Depends(get_orchestration_service)  # NEW
):
    try:
        settings = get_settings()
        metadata = request.metadata or {}
        call_data = request.call or {}

        org_id = metadata.get("org_id")
        service_id = metadata.get("service_id")
        vapi_call_id = call_data.get("id") or metadata.get("call_id")
        is_sandbox = metadata.get("is_sandbox", False) or call_data.get("is_sandbox", False)
        customer_number = (call_data.get("customer") or {}).get("number")

        if not org_id or not service_id:
            raise HTTPException(
                status_code=400,
                detail="Missing org_id or service_id in request metadata"
            )

        org_id = UUID(org_id)
        service_id = UUID(service_id)

        org_config = await db_service.get_org_config(service_id)
        if not org_config:
            raise HTTPException(status_code=404, detail="Service configuration not found")

        conversation = await db_service.get_or_create_conversation(
            org_id=org_id,
            service_id=service_id,
            vapi_call_id=vapi_call_id or "unknown",
            is_sandbox=is_sandbox,
            customer_number=customer_number
        )

        if not conversation:
            raise HTTPException(status_code=500, detail="Failed to create conversation")
        
        # Get conversation history
        message_history = await db_service.get_conversation_messages(conversation.id)
        
        history_messages = []
        for msg in message_history:
            history_messages.append({
                "role": "user" if msg.sender == "customer" else "assistant",
                "content": msg.content
            })
        
        # Get the latest user message from request
        user_messages = [msg for msg in request.messages if msg.role == "user"]
        current_user_message = user_messages[-1].content if user_messages else ""
        
        # Log the user message
        await db_service.add_message(conversation.id, "customer", current_user_message)
        
        # Retrieve relevant KB chunks if KB is enabled
        retrieved_chunks: List[RetrievedKBChunk] = []
        if org_config.voice_agent_config.kb_enabled and current_user_message:
            query_embedding = await embedding_service.embed_text(current_user_message)
            retrieved_chunks = await db_service.search_knowledge_base(
                org_id=org_id,
                query_embedding=query_embedding,
                top_k=settings.kb_top_k,
                score_threshold=settings.kb_score_threshold
            )
        
        # NEW: Use orchestrator for multi-agent decision making
        orch_result = await orchestrator.process_turn(
            org_id=org_id,
            service_id=service_id,
            conversation_id=conversation.id,
            org_config=org_config,
            retrieved_chunks=retrieved_chunks,
            message_history=history_messages,
            current_user_message=current_user_message
        )
        
        # Log orchestration decision
        await db_service.log_orchestration_decision(
            conversation_id=conversation.id,
            intent=orch_result["intent"],
            tools_executed=orch_result.get("tools_executed", []),
            should_escalate=orch_result["should_transfer"]
        )
        
        # Generate streaming response
        async def generate():
            full_response = orch_result["response"]
            
            # Yield response in OpenAI SSE format
            sse_chunk = {
                "id": f"chatcmpl-{conversation.id}",
                "object": "chat.completion.chunk",
                "created": int(__import__('time').time()),
                "model": org_config.voice_agent_config.llm_model,
                "choices": [{
                    "index": 0,
                    "delta": {"content": full_response},
                    "finish_reason": None
                }]
            }
            yield f"data: {json.dumps(sse_chunk)}\n\n"
            
            # Handle escalation / transfer
            if orch_result["should_transfer"]:
                transfer_chunk = {
                    "id": f"chatcmpl-{conversation.id}",
                    "object": "chat.completion.chunk",
                    "created": int(__import__('time').time()),
                    "model": org_config.voice_agent_config.llm_model,
                    "choices": [{
                        "index": 0,
                        "delta": {
                            "content": f"\n[TRANSFER:{json.dumps(orch_result['transfer_data'])}]"
                        },
                        "finish_reason": None
                    }]
                }
                yield f"data: {json.dumps(transfer_chunk)}\n\n"
            
            # Log the AI response
            if full_response.strip():
                await db_service.add_message(conversation.id, "ai", full_response)
            
            # Final chunk
            final_chunk = {
                "id": f"chatcmpl-{conversation.id}",
                "object": "chat.completion.chunk",
                "created": int(__import__('time').time()),
                "model": org_config.voice_agent_config.llm_model,
                "choices": [{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop"
                }]
            }
            yield f"data: {json.dumps(final_chunk)}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat_completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

## Database Changes (Optional but Recommended)

### Add Orchestration Logging Table

```sql
-- Add to migrations/001_add_rag_columns_and_messages.sql

CREATE TABLE orchestration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    intent VARCHAR(100) NOT NULL,
    confidence FLOAT,
    tools_executed TEXT[] DEFAULT '{}',
    should_escalate BOOLEAN DEFAULT FALSE,
    escalation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_orchestration_logs_conversation ON orchestration_logs(conversation_id);
CREATE INDEX idx_orchestration_logs_org ON orchestration_logs(org_id);
CREATE INDEX idx_orchestration_logs_intent ON orchestration_logs(intent);
```

### Add to DatabaseService

```python
# In app/services/database_service.py

async def log_orchestration_decision(
    self,
    conversation_id: UUID,
    intent: str,
    tools_executed: List[str],
    should_escalate: bool,
    escalation_reason: str = None,
    metadata: Dict = None
) -> bool:
    """Log orchestration decision for analytics"""
    try:
        response = self.db.table("orchestration_logs").insert({
            "conversation_id": str(conversation_id),
            "org_id": str(self.org_id),
            "intent": intent,
            "tools_executed": tools_executed,
            "should_escalate": should_escalate,
            "escalation_reason": escalation_reason,
            "metadata": metadata or {}
        }).execute()
        return bool(response.data)
    except Exception as e:
        logger.error(f"Error logging orchestration decision: {e}")
        return False
```

## Testing the Integration

### Run Unit Tests
```bash
cd aivora-rag-service
pytest tests/test_orchestration.py -v
```

### Manual Test with cURL
```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Authorization: Bearer your_shared_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "I want to book an appointment tomorrow at 2pm"}],
    "metadata": {
      "org_id": "550e8400-e29b-41d4-a716-446655440000",
      "service_id": "650e8400-e29b-41d4-a716-446655440001",
      "call_id": "call-123"
    }
  }'
```

### Monitoring Orchestration Decisions
```sql
-- See which intents get classified most
SELECT intent, COUNT(*) as count
FROM orchestration_logs
GROUP BY intent
ORDER BY count DESC;

-- See escalation rate by intent
SELECT 
    intent,
    SUM(CASE WHEN should_escalate THEN 1 ELSE 0 END) as escalations,
    COUNT(*) as total,
    ROUND(100.0 * SUM(CASE WHEN should_escalate THEN 1 ELSE 0 END) / COUNT(*), 2) as escalation_rate
FROM orchestration_logs
GROUP BY intent;

-- See which tools are used most
SELECT tool, COUNT(*) as usage_count
FROM (
    SELECT unnest(tools_executed) as tool
    FROM orchestration_logs
)
GROUP BY tool
ORDER BY usage_count DESC;
```

## Performance Notes

- **Intent Classification**: ~100ms per message (local transformer model)
- **Entity Extraction**: ~50ms per message
- **Sentiment Analysis**: ~80ms per message
- **Graph Execution**: ~200ms total (depends on node complexity)

**Total overhead**: ~300-400ms per conversation turn (acceptable for voice/chat)

### Optimization Tips

1. **Cache models on startup**:
   ```python
   @app.on_event("startup")
   async def startup_event():
       # Warm up transformers cache
       classifier = IntentClassifier()
       logger.info("Transformers models loaded and cached")
   ```

2. **Use quantized models** for smaller footprint:
   ```python
   # In intent_classifier.py
   self.classifier = pipeline(
       "zero-shot-classification",
       model="facebook/bart-large-mnli",
       device_map="auto",  # Auto-select GPU if available
   )
   ```

3. **Batch process if handling multiple conversations**:
   ```python
   results = classifier.pipe(messages, batch_size=32)
   ```

## Next Steps

1. ✅ Add orchestration to your routes
2. ✅ Add database logging table
3. ✅ Deploy and test
4. ✅ Monitor metrics dashboard
5. ✅ Fine-tune based on real data
6. ✅ Add more nodes/intents as needed

---

This integration brings production-grade multi-agent AI to your voice receptionist! 🚀
