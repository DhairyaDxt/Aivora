from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field
from app.models.database import BusinessProfile, VoiceAgentConfig


# Vapi Custom LLM Request/Response (OpenAI-compatible)
class VapiMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


class VapiChatCompletionRequest(BaseModel):
    messages: List[VapiMessage]
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    stream: bool = True
    metadata: Optional[Dict[str, Any]] = None
    call: Optional[Dict[str, Any]] = None


class VapiChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: List[Dict[str, Any]]


# KB Reembed Request
class KBReembedRequest(BaseModel):
    org_id: UUID
    entry_id: Optional[UUID] = None


# KB Parse Document Request
class KBParseDocumentRequest(BaseModel):
    org_id: UUID
    storage_path: str


# KB Parse Text Request
class KBParseTextRequest(BaseModel):
    org_id: UUID
    text: str


# Tool Calling Schemas
class ToolCall(BaseModel):
    name: str
    arguments: Dict[str, Any]
    id: str


class ToolResult(BaseModel):
    tool_call_id: str
    result: Dict[str, Any]


# Tool Definitions
class CheckAvailabilityArgs(BaseModel):
    service_id: UUID
    date: str  # YYYY-MM-DD
    duration_minutes: int = 30


class BookAppointmentArgs(BaseModel):
    service_id: UUID
    customer_name: str
    customer_phone: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    duration_minutes: int = 30
    notes: Optional[str] = None


class TransferCallArgs(BaseModel):
    phone_number: Optional[str] = None
    reason: Optional[str] = None


class TakeMessageArgs(BaseModel):
    conversation_id: UUID
    summary: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    callback_requested: bool = False


# Internal service schemas
class OrgConfig(BaseModel):
    org_id: UUID
    business_profile: Optional[BusinessProfile] = None
    voice_agent_config: VoiceAgentConfig
    service_id: UUID


class RetrievedKBChunk(BaseModel):
    id: UUID
    title: Optional[str]
    content: str
    similarity: float


class ChatCompletionContext(BaseModel):
    org_config: OrgConfig
    conversation_id: UUID
    vapi_call_id: Optional[str]
    is_sandbox: bool
    retrieved_chunks: List[RetrievedKBChunk]
    message_history: List[VapiMessage]
    current_user_message: str