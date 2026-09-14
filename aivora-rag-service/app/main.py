from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import sys

from app.api.routes import router as api_router
from app.core.config import get_settings


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Aivora RAG Service...")
    settings = get_settings()
    logger.info(f"Supabase URL: {settings.supabase_url}")
    logger.info(f"Embedding model: {settings.embedding_model}")
    yield
    # Shutdown
    logger.info("Shutting down Aivora RAG Service...")


def create_app() -> FastAPI:
    settings = get_settings()
    
    app = FastAPI(
        title="Aivora RAG Service",
        description="Knowledge Base / RAG / AI Orchestration Service for Aivora",
        version="1.0.0",
        lifespan=lifespan
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include API routes
    app.include_router(api_router)
    
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=True,
        log_level=settings.log_level.lower()
    )