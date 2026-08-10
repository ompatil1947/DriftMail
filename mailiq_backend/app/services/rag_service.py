"""
Category -> matching knowledge-base doc. Kept deliberately simple and
dependency-free. Upgrade path if you want to build it out further: chunk
the docs, embed with sentence-transformers, FAISS similarity search over
chunks instead of a category lookup.
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
