from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from uuid import UUID
from typing import Optional, List, Dict, Any
import json
import logging
import time

from app.schemas.api import (
    VapiChatCompletionRequest, VapiChatCompletionChunk,
    KBReembedRequest, KBParseDocumentRequest, KBParseTextRequest,
    KBSearchRequest, KBSearchResponse, RetrievedKBChunk
)
from app.services.database_service import DatabaseService
from app.services.embedding_service import EmbeddingService
from app.services.llm_service import LLMService
from app.services.kb_service import KBService
from app.tools.executor import ToolExecutor
from app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer(auto_error=False)

# Dependency injection
def get_db_service() -> DatabaseService:
    return DatabaseService()

def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()

def get_tool_executor(db_service: DatabaseService = Depends(get_db_service)) -> ToolExecutor:
    return ToolExecutor(db_service)

def get_llm_service(
    db_service: DatabaseService = Depends(get_db_service),
    tool_executor: ToolExecutor = Depends(get_tool_executor)
) -> LLMService:
    return LLMService(db_service, tool_executor)

def get_kb_service(
    db_service: DatabaseService = Depends(get_db_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service)
) -> KBService:
    return KBService(db_service, embedding_service)


async def verify_orchestration_auth(
    authorization: Optional[str] = Header(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> None:
    """Verify the ORCHESTRATION_SHARED_SECRET in Authorization header"""
    settings = get_settings()
    expected_secret = settings.orchestration_shared_secret
    
    # Check both Authorization header and Bearer token
    provided_secret = None
    if authorization:
        provided_secret = authorization.replace("Bearer ", "").strip()
    elif credentials:
        provided_secret = credentials.credentials
    
    if not provided_secret or provided_secret != expected_secret:
        logger.warning(f"Invalid orchestration auth attempt. Provided: {provided_secret[:10] if provided_secret else 'None'}...")
        raise HTTPException(status_code=401, detail="Invalid orchestration authentication")


@router.post("/v1/chat/completions")
async def chat_completions(
    request: VapiChatCompletionRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    db_service: DatabaseService = Depends(get_db_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    llm_service: LLMService = Depends(get_llm_service)
):
    """
    Vapi Custom LLM endpoint - OpenAI compatible streaming response
    """
    try:
        settings = get_settings()

        # Extract metadata from request
        metadata = request.metadata or {}
        call_data = request.call or {}

        # Get org_id and service_id from metadata (set at assistant creation
        # in voice.functions.ts). These must come from metadata specifically -
        # falling back to call_data.get("assistantId") here would silently
        # resolve to the wrong org (an assistant ID is not an org ID).
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

        # Get org config (business profile + voice agent config)
        org_config = await db_service.get_org_config(service_id)
        if not org_config:
            raise HTTPException(status_code=404, detail="Service configuration not found")

        voice_config = org_config.voice_agent_config

        # Check if KB is enabled
        kb_enabled = voice_config.kb_enabled

        # Get or create conversation, keyed by the actual Vapi call ID (not
        # overloaded into customer_identifier) so the end-of-call webhook can
        # find and reuse this same row instead of creating a duplicate.
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
        
        # Convert to VapiMessage format
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
        if kb_enabled and current_user_message:
            query_embedding = await embedding_service.embed_text(current_user_message)
            retrieved_chunks = await db_service.search_knowledge_base(
                org_id=org_id,
                query_embedding=query_embedding,
                top_k=settings.kb_top_k,
                score_threshold=settings.kb_score_threshold
            )
        
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
                sse_chunk = {
                    "id": f"chatcmpl-{conversation.id}",
                    "object": "chat.completion.chunk",
                    "created": int(__import__('time').time()),
                    "model": voice_config.llm_model,
                    "choices": [{
                        "index": 0,
                        "delta": {"content": chunk},
                        "finish_reason": None
                    }]
                }
                yield f"data: {json.dumps(sse_chunk)}\n\n"
            
            # Log the AI response
            if full_response.strip():
                await db_service.add_message(conversation.id, "ai", full_response)
            
            # Final chunk
            final_chunk = {
                "id": f"chatcmpl-{conversation.id}",
                "object": "chat.completion.chunk",
                "created": int(__import__('time').time()),
                "model": voice_config.llm_model,
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


@router.post("/v1/kb/reembed")
async def reembed_knowledge_base(
    request: KBReembedRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    kb_service: KBService = Depends(get_kb_service)
):
    """Re-embed knowledge base entries"""
    try:
        org_id = request.org_id
        entry_id = request.entry_id
        
        result = await kb_service.reembed_entries(org_id, entry_id)
        return result
    except Exception as e:
        logger.error(f"Error in reembed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/kb/search", response_model=KBSearchResponse)
async def search_knowledge_base(
    request: KBSearchRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    db_service: DatabaseService = Depends(get_db_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service)
):
    """
    Real pgvector semantic search over an org's knowledge base. Used by
    channels that don't go through the voice/Vapi custom-LLM path (e.g. the
    WhatsApp reply loop) so they get proper retrieval instead of dumping the
    whole KB into the prompt.
    """
    try:
        settings = get_settings()
        query_embedding = await embedding_service.embed_text(request.query)
        chunks = await db_service.search_knowledge_base(
            org_id=request.org_id,
            query_embedding=query_embedding,
            top_k=request.top_k or settings.kb_top_k,
            score_threshold=settings.kb_score_threshold
        )
        return KBSearchResponse(chunks=chunks)
    except Exception as e:
        logger.error(f"Error in kb search: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/kb/parse-document")
async def parse_document(
    request: KBParseDocumentRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    kb_service: KBService = Depends(get_kb_service)
):
    """Parse an uploaded document and create KB entries"""
    try:
        result = await kb_service.parse_document(request.org_id, request.storage_path)
        return result
    except Exception as e:
        logger.error(f"Error parsing document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/kb/parse-text")
async def parse_text(
    request: KBParseTextRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    kb_service: KBService = Depends(get_kb_service)
):
    """Parse a single pasted block of business info and create KB entries"""
    try:
        result = await kb_service.parse_text(request.org_id, request.text)
        return result
    except Exception as e:
        logger.error(f"Error parsing text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "aivora-rag"}