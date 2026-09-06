from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


class Organization(BaseModel):
    id: UUID
    name: str
    slug: str
    industry_vertical: Optional[str] = None
    country: Optional[str] = None
    timezone: str = "UTC"
    created_at: datetime


class BusinessProfile(BaseModel):
    org_id: UUID
    legal_name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    business_hours: Optional[Dict[str, Any]] = None
    languages: List[str] = ["en"]
    updated_at: Optional[datetime] = None


class KnowledgeBaseEntry(BaseModel):
    id: UUID
    org_id: UUID
    type: str
    title: Optional[str] = None
    content: str
    embedding: Optional[List[float]] = None
    source: str = "manual"
    status: str = "ready"
    file_path: Optional[str] = None
    embedded_at: Optional[datetime] = None
    needs_review: bool = False
    created_at: datetime


class Service(BaseModel):
    id: UUID
    org_id: UUID
    type: str = "voice"
    name: Optional[str] = None
    status: str = "draft"
    preview_opened_at: Optional[datetime] = None
    created_at: datetime
    deployed_at: Optional[datetime] = None


class VoiceAgentConfig(BaseModel):
    service_id: UUID
    persona_name: Optional[str] = None
    greeting_script: Optional[str] = None
    consent_enabled: bool = True
    consent_message: str = "This call may be recorded and you are speaking with an AI assistant."
    language: str = "en"
    transcriber_provider: str = "deepgram"
    transcriber_model: str = "nova-2"
    transcriber_language: str = "en"
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    # None means "use the provider-appropriate default" (see
    # llm_service.DEFAULT_ESCALATION_MODEL) rather than baking in one
    # provider's model name for every org regardless of llm_provider.
    llm_model_escalated: Optional[str] = None
    temperature: float = 0.5
    custom_llm_url: Optional[str] = None
    kb_enabled: bool = True
    voice_provider: str = "11labs"
    voice_id: Optional[str] = None
    voice_model: str = "eleven_turbo_v2_5"
    functions_enabled: Dict[str, bool] = Field(default_factory=lambda: {
        "check_availability": True,
        "book_appointment": True,
        "transfer_call": True,
        "take_message": True
    })
    business_hours_override: Optional[Dict[str, Any]] = None
    escalation_number: Optional[str] = None
    after_hours_behavior: str = "voicemail"
    max_call_duration_seconds: int = 600
    recording_enabled: bool = True
    barge_in_enabled: bool = True
    vapi_assistant_id: Optional[str] = None
    vapi_phone_number_id: Optional[str] = None
    flow_ui_state: Optional[Dict[str, Any]] = None
    updated_at: Optional[datetime] = None


class Conversation(BaseModel):
    id: UUID
    org_id: UUID
    service_id: Optional[UUID] = None
    channel: str = "voice"
    customer_identifier: Optional[str] = None
    vapi_call_id: Optional[str] = None
    status: str = "active"
    resolution_type: Optional[str] = None
    is_sandbox: bool = False
    started_at: datetime
    ended_at: Optional[datetime] = None


class Message(BaseModel):
    id: UUID
    conversation_id: UUID
    sender: str  # 'customer' | 'ai'
    content: str
    created_at: datetime


class CallLog(BaseModel):
    id: UUID
    conversation_id: UUID
    vapi_call_id: Optional[str] = None
    duration_seconds: Optional[int] = None
    recording_url: Optional[str] = None
    transcript: Optional[str] = None
    outcome: Optional[str] = None
    created_at: datetime