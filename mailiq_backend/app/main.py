"""
DriftMail API — FastAPI entry point.

Startup lifespan:
  • Creates all SQLAlchemy tables (idempotent — safe to re-run)
  • Warms up the SemanticRAGService (loads sentence-transformers, indexes KB)
"""
import os
os.environ["USE_TF"] = "0"
os.environ["USE_TORCH"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.routers import auth, emails, gmail, inference
from app.services.rag_service import semantic_rag


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    # Create DB tables (no-op if they already exist)
    Base.metadata.create_all(bind=engine)
    # Warm up the semantic RAG service (heavy model load done once here)
    semantic_rag.startup()
    yield
    # ── Shutdown (nothing to clean up) ───────────────────────────────────────


app = FastAPI(
    title="DriftMail — AI Email Intelligence Assistant",
    description="BiGRU multi-task email classifier (category + priority) with a grounded RAG Q&A feature.",
    version="3.0.0",
    lifespan=lifespan,
)

# Allow the React dev server (and production build) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        settings.frontend_url
    ] if settings.frontend_url else ["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inference.router, tags=["inference"])
app.include_router(auth.router)
app.include_router(gmail.router)
app.include_router(emails.router)


@app.get("/")
def root():
    return {"message": "DriftMail API v3. See /docs for interactive API documentation."}
