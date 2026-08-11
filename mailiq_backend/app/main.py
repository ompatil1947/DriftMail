"""
DriftMail API — FastAPI entry point.

Startup lifespan:
  • Creates all SQLAlchemy tables (idempotent — safe to re-run)

Memory optimisation:
  • No heavy models are pre-loaded at startup.
  • BiGRU classifier loads lazily on the first classify request.
  • SemanticRAGService initialises lazily on the first /ask request.
  • This keeps startup RAM ~65 MB instead of ~415 MB on Render's free tier.
"""
import os
os.environ["USE_TF"] = "0"
os.environ["USE_TORCH"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["PYTORCH_NO_CUDA_MEMORY_CACHING"] = "1"

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.routers import auth, emails, gmail, inference
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    # Create DB tables (no-op if they already exist)
    Base.metadata.create_all(bind=engine)
    print("[main] Database tables created/verified.")
    print("[main] App ready — BiGRU & RAG models will load lazily on first use.")
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("[main] Shutting down DriftMail API.")


app = FastAPI(
    title="DriftMail — AI Email Intelligence Assistant",
    description="BiGRU multi-task email classifier (category + priority) with a grounded RAG Q&A feature.",
    version="3.1.0",
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
    return {
        "message": "DriftMail API v3.1. See /docs for interactive API documentation.",
        "note": "Models load lazily on first use to conserve startup memory.",
    }
