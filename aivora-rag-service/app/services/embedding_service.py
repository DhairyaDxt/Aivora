from typing import List, Optional
from google import genai
from google.genai import types
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)

# Must match the pgvector column width (knowledge_base_entries.embedding is
# vector(1536)) so switching embedding providers doesn't require a schema
# migration. gemini-embedding-001 supports truncating its native output down
# to this via output_dimensionality (recommended sizes: 768, 1536, 3072).
EMBEDDING_DIMENSIONS = 1536


class EmbeddingService:
    def __init__(self):
        self.settings = get_settings()
        self.client = genai.Client(api_key=self.settings.gemini_api_key)

    async def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        try:
            response = await self.client.aio.models.embed_content(
                model=self.settings.embedding_model,
                contents=text,
                config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
            )
            return response.embeddings[0].values
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            raise

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        try:
            response = await self.client.aio.models.embed_content(
                model=self.settings.embedding_model,
                contents=texts,
                config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
            )
            return [embedding.values for embedding in response.embeddings]
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise

    async def embed_kb_entry(self, title: Optional[str], content: str) -> List[float]:
        """Embed a KB entry (title + content)"""
        text = f"{title}\n\n{content}" if title else content
        return await self.embed_text(text)
