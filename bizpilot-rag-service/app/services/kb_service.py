from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID
import pdfplumber
import io
from google import genai
from google.genai import types
from supabase import create_client
from app.core.config import get_settings
from app.services.database_service import DatabaseService
from app.services.embedding_service import EmbeddingService
from app.prompts.templates import get_document_parsing_prompt
import json
import logging

logger = logging.getLogger(__name__)


class KBService:
    def __init__(self, db_service: DatabaseService, embedding_service: EmbeddingService):
        self.db = db_service
        self.embedding_service = embedding_service
        self.settings = get_settings()
        self.genai_client = genai.Client(api_key=self.settings.gemini_api_key)
        self.supabase_client = create_client(
            self.settings.supabase_url,
            self.settings.supabase_service_role_key
        )
    
    async def reembed_entries(self, org_id: UUID, entry_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Re-embed KB entries that need embedding"""
        entries = await self.db.get_kb_entries_needing_embedding(org_id, entry_id)
        
        results = {
            "processed": 0,
            "failed": 0,
            "entries": []
        }
        
        for entry in entries:
            try:
                embedding = await self.embedding_service.embed_kb_entry(entry.title, entry.content)
                success = await self.db.update_kb_embedding(entry.id, embedding)
                
                if success:
                    results["processed"] += 1
                    results["entries"].append({
                        "id": str(entry.id),
                        "title": entry.title,
                        "status": "embedded"
                    })
                else:
                    results["failed"] += 1
                    results["entries"].append({
                        "id": str(entry.id),
                        "title": entry.title,
                        "status": "failed"
                    })
            except Exception as e:
                logger.error(f"Error embedding entry {entry.id}: {e}")
                results["failed"] += 1
                results["entries"].append({
                    "id": str(entry.id),
                    "title": entry.title,
                    "status": "error",
                    "error": str(e)
                })
        
        return results
    
    async def parse_document(self, org_id: UUID, storage_path: str) -> Dict[str, Any]:
        """Parse an uploaded document and create KB entries"""
        try:
            # Download file from Supabase Storage
            file_data = self.supabase_client.storage.from_("knowledge-docs").download(storage_path)

            # Extract text based on file type
            text = self._extract_text_from_file(file_data, storage_path)

            if not text or len(text.strip()) < 50:
                return {
                    "success": False,
                    "error": "Could not extract meaningful text from document"
                }

            return await self._extract_and_insert_entries(
                org_id, text, source="document", file_path=storage_path
            )

        except Exception as e:
            logger.error(f"Error parsing document {storage_path}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def parse_text(self, org_id: UUID, text: str) -> Dict[str, Any]:
        """Parse pasted business text (the 'complete prompt' box) and create KB entries"""
        if not text or len(text.strip()) < 50:
            return {
                "success": False,
                "error": "Write a bit more about the business before submitting."
            }

        try:
            return await self._extract_and_insert_entries(org_id, text, source="prompt")
        except Exception as e:
            logger.error(f"Error parsing pasted text for org {org_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _extract_and_insert_entries(
        self,
        org_id: UUID,
        text: str,
        source: str,
        file_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the shared LLM extraction over raw text and insert the resulting KB entries.

        Uses Gemini rather than the voice-call LLM: this extraction step has
        nothing to do with a live phone call, so there's no reason to spend
        Vapi-billed OpenAI usage on it when Google AI Studio's free tier
        handles structured extraction like this well.
        """
        parsing_prompt = get_document_parsing_prompt(text)

        response = await self.genai_client.aio.models.generate_content(
            model=self.settings.kb_extraction_model,
            contents=parsing_prompt,
            config=types.GenerateContentConfig(
                system_instruction="You are an expert at extracting structured knowledge from business documents. Return only valid JSON.",
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )

        parsed_data = json.loads(response.text)

        # Handle both array and object with entries key
        entries_data = parsed_data if isinstance(parsed_data, list) else parsed_data.get("entries", [])

        if not entries_data:
            return {
                "success": False,
                "error": "Could not find any usable business details in that text."
            }

        # Embed each entry now, at write time - nothing else in this system
        # ever calls the reembed endpoint automatically, so an entry left
        # unembedded here would never become searchable.
        kb_entries = []
        for entry in entries_data:
            content = entry.get("content")
            if not content:
                continue
            title = entry.get("title")
            try:
                embedding = await self.embedding_service.embed_kb_entry(title, content)
                embedded_at = datetime.now(timezone.utc).isoformat()
            except Exception as e:
                logger.error(f"Error embedding extracted entry '{title}': {e}")
                embedding = None
                embedded_at = None
            kb_entries.append({
                "org_id": str(org_id),
                "type": entry.get("type", "other"),
                "title": title,
                "content": content,
                "source": source,
                "status": "ready",
                "file_path": file_path,
                "embedding": embedding,
                "embedded_at": embedded_at,
                "needs_review": True
            })

        inserted = await self.db.insert_kb_entries(kb_entries)

        return {
            "success": True,
            "entries_created": len(inserted),
            "entries": [{"id": str(e.id), "title": e.title, "type": e.type} for e in inserted]
        }
    
    def _extract_text_from_file(self, file_data: bytes, filename: str) -> str:
        """Extract text from PDF or other document types"""
        try:
            if filename.lower().endswith('.pdf'):
                with pdfplumber.open(io.BytesIO(file_data)) as pdf:
                    text_parts = []
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_parts.append(page_text)
                    return "\n\n".join(text_parts)
            else:
                # Try to decode as text
                return file_data.decode('utf-8', errors='ignore')
        except Exception as e:
            logger.error(f"Error extracting text from {filename}: {e}")
            return ""