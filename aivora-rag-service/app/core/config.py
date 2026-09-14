import os
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    
    # OpenAI - used only for the live voice-call LLM (llm_provider="openai"),
    # since that usage is billed through Vapi's own credits rather than a
    # separate OpenAI account.
    openai_api_key: str

    # Anthropic (optional) - same voice-call usage as above, when
    # llm_provider="anthropic".
    anthropic_api_key: Optional[str] = None

    # Google AI Studio (Gemini) - used for everything that is NOT the live
    # voice call: knowledge-base embeddings and the LLM extraction that turns
    # pasted text/documents into structured KB entries. Free tier: get a key
    # at https://aistudio.google.com/app/apikey
    gemini_api_key: str
    embedding_model: str = "gemini-embedding-001"
    kb_extraction_model: str = "gemini-2.5-flash"

    # Orchestration
    orchestration_shared_secret: str

    # Calendly OAuth app - same credentials as the frontend's
    # CALENDLY_OAUTH_CLIENT_ID/SECRET. Needed so booking tools can refresh a
    # tenant's expired access token mid-call, exactly like calendly.server.ts
    # does on the frontend path. Booking degrades to take_message without them.
    calendly_oauth_client_id: Optional[str] = None
    calendly_oauth_client_secret: Optional[str] = None
    
    # App
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"
    
    # RAG settings
    kb_top_k: int = 4
    kb_score_threshold: float = 0.3
    max_conversation_turns_before_escalation: int = 6
    max_message_length_before_escalation: int = 500
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()