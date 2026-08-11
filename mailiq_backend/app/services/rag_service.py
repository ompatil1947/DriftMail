"""
Two RAG services in one module:

1. get_context(category) -- original category-based KB lookup. UNCHANGED.

2. SemanticRAGService -- embedding-based similarity search over all KB
   snippets using Gemini's cloud embedding API (text-embedding-004),
   followed by a grounded Gemini generation.

   IMPORTANT: No local model weights are loaded. All embedding happens
   via Google's API, keeping memory usage near zero.
   The service is fully lazy — nothing initialises until the first ask().
"""
import gc
import glob
import math
import os
from typing import Optional

KB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "knowledge_base")
CONTEXT_TRIGGER_CATEGORIES = {"college", "oportunities", "finance"}

_docs_cache = None


def _load_docs():
    global _docs_cache
    if _docs_cache is None:
        _docs_cache = {}
        for path in glob.glob(os.path.join(KB_DIR, "*.md")):
            name = os.path.splitext(os.path.basename(path))[0]
            with open(path, "r", encoding="utf-8") as f:
                _docs_cache[name] = f.read()
    return _docs_cache


def get_context(category: str):
    if category not in CONTEXT_TRIGGER_CATEGORIES:
        return None
    docs = _load_docs()
    doc = docs.get(category)
    if not doc:
        return None
    return doc.strip().split("\n\n")[1].strip()


# ─────────────────────────────────────────────────────────────────────────────
# Semantic RAG Service — Gemini Embedding API (cloud, zero local RAM)
# ─────────────────────────────────────────────────────────────────────────────

SIMILARITY_THRESHOLD = 0.3
TOP_K = 2
FALLBACK_PHRASE = "I don't have that information in this email."

_GENERATION_PROMPT = """\
You are answering a question about ONE specific email. Use ONLY the email content and the reference notes below. If the answer is not contained in either, say so explicitly instead of guessing.

EMAIL SUBJECT: {subject}
EMAIL BODY: {body}

REFERENCE NOTES:
{notes}

QUESTION: {question}

Answer in 1-3 sentences. If the email and notes don't contain the answer, respond with exactly: "I don't have that information in this email." Do not use outside knowledge.\
"""


def _dot(a: list[float], b: list[float]) -> float:
    """Pure-Python dot product for normalised vectors (= cosine similarity)."""
    return sum(x * y for x, y in zip(a, b))


def _normalize(vec: list[float]) -> list[float]:
    mag = math.sqrt(sum(x * x for x in vec))
    if mag == 0:
        return vec
    return [x / mag for x in vec]


class SemanticRAGService:
    """
    Answers per-email questions using Gemini embedding API for retrieval
    and Gemini generation for the answer.  No local model weights needed.

    Fully lazy: nothing happens until the first ask() call.
    """

    def __init__(self):
        self._snippets: list[str] = []
        self._embeddings: list[list[float]] = []  # list of normalised float lists
        self._ready = False
        self._genai = None          # cached genai module reference

    def _get_genai(self):
        """Import and configure google.generativeai once, cache it."""
        if self._genai is not None:
            return self._genai
        from app.core.config import settings
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        self._genai = genai
        return genai

    def _embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts using Gemini text-embedding-004."""
        genai = self._get_genai()
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=texts,
            task_type="retrieval_document",
        )
        return [_normalize(e) for e in result["embedding"]]

    def _embed_query(self, text: str) -> list[float]:
        """Embed a single query string."""
        genai = self._get_genai()
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_query",
        )
        return _normalize(result["embedding"])

    def _load_snippets(self) -> list[str]:
        snippets = []
        for path in sorted(glob.glob(os.path.join(KB_DIR, "*.md"))):
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
            for para in text.split("\n\n"):
                cleaned = para.strip()
                if len(cleaned) > 30:
                    snippets.append(cleaned)
        return snippets

    def _startup(self):
        """Lazy init: embed all KB snippets once via Gemini API."""
        try:
            self._snippets = self._load_snippets()
            if self._snippets:
                self._embeddings = self._embed_texts(self._snippets)
            else:
                self._embeddings = []
            self._ready = True
            print(
                f"[rag_service] SemanticRAGService ready — "
                f"{len(self._snippets)} KB snippets indexed via Gemini embeddings."
            )
        except Exception as exc:
            print(f"[rag_service] WARNING: Could not initialise SemanticRAGService: {exc}")
            self._ready = False
        finally:
            gc.collect()

    def _cosine_top_k(self, q_vec: list[float], k: int = TOP_K) -> list[tuple[float, str]]:
        """Returns list of (score, snippet) sorted desc."""
        if not self._embeddings:
            return []
        scored = [((_dot(emb, q_vec)), snip) for emb, snip in zip(self._embeddings, self._snippets)]
        scored.sort(reverse=True)
        return [(s, snip) for s, snip in scored[:k] if s >= SIMILARITY_THRESHOLD]

    def ask(self, subject: str, body: str, question: str) -> dict:
        """
        Returns {"answer": str, "grounded": bool}.
        Falls back gracefully if the Gemini API isn't reachable.
        """
        # Lazy initialisation — runs exactly once
        if not self._ready:
            print("[rag_service] Lazy init: embedding KB snippets via Gemini API...")
            self._startup()
            if not self._ready:
                return {
                    "answer": (
                        "AI assistance is temporarily unavailable. "
                        "Please check that GEMINI_API_KEY is set."
                    ),
                    "grounded": False,
                }

        try:
            # 1. Embed question via Gemini API (no local inference)
            q_vec = self._embed_query(question)

            # 2. Retrieve top-k KB snippets above similarity threshold
            hits = self._cosine_top_k(q_vec, k=TOP_K)
            notes = "\n\n---\n\n".join(snip for _, snip in hits) if hits else "none found"

            # 3. Build grounded prompt
            prompt = _GENERATION_PROMPT.format(
                subject=subject,
                body=body[:3000],
                notes=notes,
                question=question,
            )

            # 4. Call Gemini for generation
            genai = self._get_genai()
            gemini_model = genai.GenerativeModel("gemini-1.5-flash")
            response = gemini_model.generate_content(prompt)
            answer = response.text.strip()

        except Exception as exc:
            return {
                "answer": f"AI generation failed: {exc}",
                "grounded": False,
            }
        finally:
            gc.collect()

        # 5. Grounding check
        answer_lower = answer.lower().strip()
        fallback_lower = FALLBACK_PHRASE.lower()
        grounded = not (
            answer_lower.startswith(fallback_lower[:25])
            or fallback_lower[:25] in answer_lower[:50]
        )

        return {"answer": answer, "grounded": grounded}

    def reset(self):
        """Force a full re-initialisation on next ask(). Call after KB changes."""
        self._snippets = []
        self._embeddings = []
        self._ready = False
        gc.collect()


# Singleton — imported by emails router
semantic_rag = SemanticRAGService()
