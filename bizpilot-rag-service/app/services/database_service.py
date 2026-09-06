from typing import Optional, List, Dict, Any
from uuid import UUID
from app.db.supabase import get_supabase_client
from app.models.database import (
    Organization, BusinessProfile, KnowledgeBaseEntry, 
    Service, VoiceAgentConfig, Conversation, Message
)
from app.schemas.api import RetrievedKBChunk
import logging

logger = logging.getLogger(__name__)


class DatabaseService:
    def __init__(self):
        self.client = get_supabase_client()
    
    # Organization & Business Profile
    async def get_organization(self, org_id: UUID) -> Optional[Organization]:
        try:
            result = self.client.table("organizations").select("*").eq("id", str(org_id)).single().execute()
            if result.data:
                return Organization(**result.data)
        except Exception as e:
            logger.error(f"Error fetching organization {org_id}: {e}")
        return None
    
    async def get_business_profile(self, org_id: UUID) -> Optional[BusinessProfile]:
        try:
            result = self.client.table("business_profiles").select("*").eq("org_id", str(org_id)).single().execute()
            if result.data:
                return BusinessProfile(**result.data)
        except Exception as e:
            logger.error(f"Error fetching business profile for org {org_id}: {e}")
        return None
    
    # Service & Voice Agent Config
    async def get_service(self, service_id: UUID) -> Optional[Service]:
        try:
            result = self.client.table("services").select("*").eq("id", str(service_id)).single().execute()
            if result.data:
                return Service(**result.data)
        except Exception as e:
            logger.error(f"Error fetching service {service_id}: {e}")
        return None
    
    async def get_voice_agent_config(self, service_id: UUID) -> Optional[VoiceAgentConfig]:
        try:
            result = self.client.table("voice_agent_configs").select("*").eq("service_id", str(service_id)).single().execute()
            if result.data:
                return VoiceAgentConfig(**result.data)
        except Exception as e:
            logger.error(f"Error fetching voice agent config for service {service_id}: {e}")
        return None
    
    async def get_org_config(self, service_id: UUID) -> Optional[Dict[str, Any]]:
        """Get combined org config: business_profile + voice_agent_config + service"""
        service = await self.get_service(service_id)
        if not service:
            return None
        
        business_profile = await self.get_business_profile(service.org_id)
        voice_agent_config = await self.get_voice_agent_config(service_id)
        
        if not voice_agent_config:
            return None
        
        return {
            "org_id": service.org_id,
            "service_id": service_id,
            "business_profile": business_profile,
            "voice_agent_config": voice_agent_config
        }
    
    # Knowledge Base
    async def search_knowledge_base(
        self, 
        org_id: UUID, 
        query_embedding: List[float], 
        top_k: int = 4, 
        score_threshold: float = 0.3
    ) -> List[RetrievedKBChunk]:
        """Search knowledge base using pgvector cosine similarity via match_kb_entries RPC"""
        try:
            result = self.client.rpc(
                "match_kb_entries",
                {
                    "query_embedding": query_embedding,
                    "match_org_id": str(org_id),
                    "match_threshold": score_threshold,
                    "match_count": top_k,
                }
            ).execute()

            chunks = []
            for row in result.data or []:
                chunks.append(RetrievedKBChunk(
                    id=UUID(row["id"]),
                    title=row.get("title"),
                    content=row["content"],
                    similarity=float(row["similarity"])
                ))
            return chunks
        except Exception as e:
            logger.error(f"Error searching knowledge base for org {org_id}: {e}")
            return []
    
    async def get_kb_entries_needing_embedding(
        self, 
        org_id: UUID, 
        entry_id: Optional[UUID] = None
    ) -> List[KnowledgeBaseEntry]:
        """Get KB entries that need (re)embedding"""
        try:
            query = self.client.table("knowledge_base_entries").select("*").eq("org_id", str(org_id))
            
            if entry_id:
                query = query.eq("id", str(entry_id))
            else:
                # Get entries where embedded_at is null or embedded_at < updated_at
                # Since we don't have updated_at, we'll check for null embedded_at
                query = query.or_("embedded_at.is.null,status.eq.needs_review")
            
            result = query.execute()
            return [KnowledgeBaseEntry(**row) for row in result.data or []]
        except Exception as e:
            logger.error(f"Error fetching KB entries needing embedding for org {org_id}: {e}")
            return []
    
    async def update_kb_embedding(
        self, 
        entry_id: UUID, 
        embedding: List[float]
    ) -> bool:
        """Update KB entry with new embedding and embedded_at timestamp"""
        try:
            from datetime import datetime
            result = self.client.table("knowledge_base_entries").update({
                "embedding": embedding,
                "embedded_at": datetime.utcnow().isoformat(),
                "needs_review": False
            }).eq("id", str(entry_id)).execute()
            return len(result.data or []) > 0
        except Exception as e:
            logger.error(f"Error updating KB embedding for entry {entry_id}: {e}")
            return False
    
    async def insert_kb_entries(self, entries: List[Dict[str, Any]]) -> List[KnowledgeBaseEntry]:
        """Insert new KB entries"""
        try:
            result = self.client.table("knowledge_base_entries").insert(entries).execute()
            return [KnowledgeBaseEntry(**row) for row in result.data or []]
        except Exception as e:
            logger.error(f"Error inserting KB entries: {e}")
            return []
    
    # Conversations & Messages
    async def get_or_create_conversation(
        self,
        org_id: UUID,
        service_id: UUID,
        vapi_call_id: str,
        is_sandbox: bool = False,
        customer_number: Optional[str] = None
    ) -> Conversation:
        """Get existing conversation by vapi_call_id, or create one.

        vapi_call_id is looked up via its own column (not overloaded into
        customer_identifier) so that the end-of-call webhook - which fires
        after this same call - can find and reuse this exact row instead of
        inserting a second, disconnected conversation for the same call.
        """
        try:
            result = (
                self.client.table("conversations")
                .select("*")
                .eq("vapi_call_id", vapi_call_id)
                .maybe_single()
                .execute()
            )
            if result and result.data:
                return Conversation(**result.data)

            new_conv = {
                "org_id": str(org_id),
                "service_id": str(service_id),
                "channel": "voice",
                "customer_identifier": customer_number,
                "vapi_call_id": vapi_call_id,
                "is_sandbox": is_sandbox,
                "status": "active"
            }
            result = self.client.table("conversations").insert(new_conv).execute()
            if result.data:
                return Conversation(**result.data[0])
        except Exception as e:
            logger.error(f"Error getting/creating conversation for call {vapi_call_id}: {e}")
        return None
    
    async def add_message(
        self, 
        conversation_id: UUID, 
        sender: str, 
        content: str
    ) -> Optional[Message]:
        """Add a message to the conversation"""
        try:
            result = self.client.table("messages").insert({
                "conversation_id": str(conversation_id),
                "sender": sender,
                "content": content
            }).execute()
            if result.data:
                return Message(**result.data[0])
        except Exception as e:
            logger.error(f"Error adding message to conversation {conversation_id}: {e}")
        return None
    
    async def get_conversation_messages(
        self, 
        conversation_id: UUID, 
        limit: int = 20
    ) -> List[Message]:
        """Get recent messages for a conversation"""
        try:
            result = self.client.table("messages").select("*").eq("conversation_id", str(conversation_id)).order("created_at", desc=True).limit(limit).execute()
            messages = [Message(**row) for row in result.data or []]
            return list(reversed(messages))  # Return in chronological order
        except Exception as e:
            logger.error(f"Error fetching messages for conversation {conversation_id}: {e}")
            return []
    
    async def end_conversation(self, conversation_id: UUID, resolution_type: Optional[str] = None):
        """Mark conversation as ended"""
        try:
            from datetime import datetime
            self.client.table("conversations").update({
                "status": "ended",
                "ended_at": datetime.utcnow().isoformat(),
                "resolution_type": resolution_type
            }).eq("id", str(conversation_id)).execute()
        except Exception as e:
            logger.error(f"Error ending conversation {conversation_id}: {e}")