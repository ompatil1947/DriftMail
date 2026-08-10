"""
Two RAG services in one module:

1. get_context(category) -- original category-based KB lookup. UNCHANGED.

2. SemanticRAGService -- new embedding-based similarity search over all KB
   snippets, followed by a grounded Gemini generation.
   Loaded lazily at startup() call from FastAPI lifespan.
"""
import glob
import os

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
# Semantic RAG Service
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


class SemanticRAGService:
    """
    Loads sentence-transformers once at startup, pre-embeds all KB snippets,
    and answers per-email questions with a grounded Gemini call.
    """

    def __init__(self):
        self._model = None
        self._snippets: list[str] = []
        self._embeddings = None     # numpy (N, D) float32
        self._ready = False

    def startup(self):
        """Call once from FastAPI lifespan to warm up heavy imports."""
        try:
            import numpy as np
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            self._snippets = self._load_snippets()
            if self._snippets:
                self._embeddings = self._model.encode(
                    self._snippets,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                )
            else:
                self._embeddings = np.empty((0, 384), dtype="float32")
            self._ready = True
            print(f"[rag_service] SemanticRAGService ready — {len(self._snippets)} KB snippets indexed.")
        except Exception as exc:
            # Degrade gracefully: RAG won't work but the rest of the app is fine
            print(f"[rag_service] WARNING: Could not initialise SemanticRAGService: {exc}")
            self._ready = False

    def _load_snippets(self) -> list[str]:
        snippets = []
        for path in sorted(glob.glob(os.path.join(KB_DIR, "*.md"))):
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
            # Split on blank lines → paragraph-sized chunks
            for para in text.split("\n\n"):
                cleaned = para.strip()
                if len(cleaned) > 30:  # skip tiny headings / empty sections
                    snippets.append(cleaned)
        return snippets

    def _cosine_top_k(self, query_vec, k: int = TOP_K) -> list[tuple[float, str]]:
        """Returns list of (score, snippet) sorted desc. query_vec must be normalised."""
        if self._embeddings is None or len(self._embeddings) == 0:
            return []
        scores = (self._embeddings @ query_vec).tolist()
        ranked = sorted(zip(scores, self._snippets), reverse=True)
        return [(s, snip) for s, snip in ranked[:k] if s >= SIMILARITY_THRESHOLD]

    def ask(self, subject: str, body: str, question: str) -> dict:
        """
        Returns {"answer": str, "grounded": bool}.
        Falls back gracefully if sentence-transformers or Gemini aren't available.
        """
        if not self._ready:
            return {
                "answer": "AI assistance is temporarily unavailable. Please ensure sentence-transformers and google-generativeai are installed.",
                "grounded": False,
            }

        from app.core.config import settings

        # 1. Embed question (normalised for cosine via dot product)
        q_vec = self._model.encode(
            question, convert_to_numpy=True, normalize_embeddings=True
        )

        # 2. Retrieve top-k KB snippets above similarity threshold
        hits = self._cosine_top_k(q_vec, k=TOP_K)
        if hits:
            notes = "\n\n---\n\n".join(snip for _, snip in hits)
        else:
            notes = "none found"

        # 3. Build grounded prompt
        prompt = _GENERATION_PROMPT.format(
            subject=subject,
            body=body[:3000],
            notes=notes,
            question=question,
        )

        # 4. Call Gemini
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.gemini_api_key)
            gemini_model = genai.GenerativeModel("gemini-flash-latest")
            response = gemini_model.generate_content(prompt)
            answer = response.text.strip()
        except Exception as exc:
            return {
                "answer": f"Gemini generation failed: {exc}",
                "grounded": False,
            }

        # 5. Grounding check — if answer starts with or closely matches fallback
        answer_lower = answer.lower().strip()
        fallback_lower = FALLBACK_PHRASE.lower()
        grounded = not (
            answer_lower.startswith(fallback_lower[:25])
            or fallback_lower[:25] in answer_lower[:50]
        )

        return {"answer": answer, "grounded": grounded}


# Singleton — imported by emails router and initialised in main.py lifespan
semantic_rag = SemanticRAGService()
