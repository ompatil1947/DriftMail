"""
Loads your trained BiGRU multi-task classifier from models/email_classifier/
(bigru_model.pt, vocab.pkl, model_config.pkl).

RENDER FREE-TIER NOTE:
  torch is NOT installed in the Render environment because just importing it
  consumes 200-300 MB, which pushes total memory over the 512 MB free-tier
  limit.  When torch is absent the classifier falls back to the keyword-based
  heuristic automatically -- no code change required to switch between the two
  environments.

LAZY LOADING:
  Even when torch IS available (local dev), the model weights are loaded only
  on the first predict() call, not at import time, to keep startup memory low.
"""
import gc
import os
import pickle
import re
import threading

MODEL_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "models", "email_classifier"
)

# Defaults (overwritten from model_config.pkl when trained model is available)
CATEGORIES = [
    "forum", "promotions", "social_media", "spam", "updates",
    "verify_code", "oportunities", "finance", "college",
]
PRIORITIES = ["high", "medium", "low"]

# Check once at import time whether torch is importable at all
_TORCH_AVAILABLE = False
try:
    import importlib.util
    _TORCH_AVAILABLE = importlib.util.find_spec("torch") is not None
except Exception:
    _TORCH_AVAILABLE = False


def clean_text(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"http\S+|www\.\S+", " <url> ", text)
    text = re.sub(r"[^a-z0-9\s<>]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str):
    return text.split()


class EmailClassifier:
    """
    BiGRU email classifier with graceful torch fallback.

    On environments where torch is not installed (e.g. Render free tier),
    the keyword heuristic is used automatically.  Where torch IS installed,
    the BiGRU model loads lazily on the first predict() call.
    """

    def __init__(self):
        self._model = None
        self._word2idx = None
        self._config = None
        self._loaded = False
        self._lock = threading.Lock()

        # Determine whether the trained model is usable in this environment
        model_files_exist = os.path.isdir(MODEL_DIR) and {
            "bigru_model.pt", "vocab.pkl", "model_config.pkl"
        }.issubset(set(os.listdir(MODEL_DIR) if os.path.isdir(MODEL_DIR) else []))

        self.using_trained_model = _TORCH_AVAILABLE and model_files_exist

        if not _TORCH_AVAILABLE:
            print("[model_service] torch not installed — using keyword heuristic classifier.")
        elif not model_files_exist:
            print("[model_service] BiGRU model files missing — using keyword heuristic classifier.")
        else:
            print("[model_service] BiGRU model files found — will lazy-load on first predict().")

    def _ensure_loaded(self):
        """Load model weights if not already loaded. Thread-safe."""
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            if self.using_trained_model:
                self._load()
            self._loaded = True

    def _load(self):
        """Actually load torch model. Called at most once."""
        try:
            import torch
            from .model_architecture import BiGRUMultiTaskClassifier

            print("[model_service] Loading BiGRU model weights into RAM...")

            with open(os.path.join(MODEL_DIR, "vocab.pkl"), "rb") as f:
                self._word2idx = pickle.load(f)
            with open(os.path.join(MODEL_DIR, "model_config.pkl"), "rb") as f:
                self._config = pickle.load(f)

            global CATEGORIES, PRIORITIES
            CATEGORIES = self._config["categories"]
            PRIORITIES = self._config["priorities"]

            self._model = BiGRUMultiTaskClassifier(
                vocab_size=self._config["vocab_size"],
                embed_dim=self._config["embed_dim"],
                hidden_dim=self._config["hidden_dim"],
                num_categories=len(CATEGORIES),
                num_priorities=len(PRIORITIES),
                num_layers=self._config["num_layers"],
                dropout=self._config["dropout"],
                pad_idx=self._config["pad_idx"],
            )
            state_dict = torch.load(
                os.path.join(MODEL_DIR, "bigru_model.pt"), map_location="cpu"
            )
            self._model.load_state_dict(state_dict)
            self._model.eval()
            gc.collect()
            print("[model_service] BiGRU model loaded successfully.")
        except Exception as exc:
            print(f"[model_service] Failed to load BiGRU model: {exc}. Falling back to heuristic.")
            self.using_trained_model = False
            self._model = None

    def _encode(self, text: str):
        pad_idx = self._config["pad_idx"]
        unk_idx = self._word2idx.get("<UNK>", 1)
        max_len = self._config["max_len"]
        tokens = tokenize(text)[:max_len]
        ids = [self._word2idx.get(t, unk_idx) for t in tokens]
        ids = ids + [pad_idx] * (max_len - len(ids))
        return ids

    def predict(self, subject: str, body: str):
        """Classify an email. Loads the model lazily on first call if torch is available."""
        self._ensure_loaded()
        text = clean_text(f"{subject}. {body}")
        if self.using_trained_model and self._model is not None:
            return self._predict_trained(text)
        return self._predict_heuristic(text)

    def _predict_trained(self, text: str):
        import torch

        ids = self._encode(text)
        input_tensor = torch.tensor([ids], dtype=torch.long)
        with torch.no_grad():
            category_logits, priority_logits = self._model(input_tensor)
        category_probs = torch.softmax(category_logits, dim=-1)
        priority_probs = torch.softmax(priority_logits, dim=-1)
        category = CATEGORIES[category_probs.argmax(dim=-1).item()]
        priority = PRIORITIES[priority_probs.argmax(dim=-1).item()]
        return (
            category,
            round(category_probs.max().item(), 3),
            priority,
            round(priority_probs.max().item(), 3),
        )

    def _predict_heuristic(self, text: str):
        """Fast keyword-based fallback — no torch required."""
        t = text
        if any(k in t for k in ["unsubscribe", "% off", "sale", "discount", "offer", "deal", "promo"]):
            category, conf = "promotions", 0.6
        elif any(k in t for k in ["hackathon", "internship", "shortlisted", "unstop", "internshala", "hiring", "job opening", "apply now"]):
            category, conf = "oportunities", 0.6
        elif any(k in t for k in ["semester", "college", "faculty", "cgpa", "exam schedule", "university", "campus"]):
            category, conf = "college", 0.55
        elif any(k in t for k in ["debited", "credited", "bank", "upi", "emi", "invoice", "payment", "transaction", "statement"]):
            category, conf = "finance", 0.6
        elif any(k in t for k in ["verification code", "otp", "one-time", "verify your", "confirm your email"]):
            category, conf = "verify_code", 0.65
        elif any(k in t for k in ["win a prize", "click here", "free money", "congratulations", "you have been selected", "claim your"]):
            category, conf = "spam", 0.6
        elif any(k in t for k in ["liked your", "friends checked in", "notifications on", "tagged you", "follow", "linkedin"]):
            category, conf = "social_media", 0.55
        elif any(k in t for k in ["thread", "reply", "upvotes", "comment", "forum", "stack overflow", "reddit"]):
            category, conf = "forum", 0.5
        else:
            category, conf = "updates", 0.4

        priority = (
            "high"
            if any(k in t for k in ["urgent", "asap", "expire", "immediately", "deadline", "action required", "important"])
            and category != "spam"
            else ("medium" if category in {"updates", "forum", "college", "verify_code"} else "low")
        )
        return category, conf, priority, 0.5


# Singleton — torch-free on Render, lazy-loaded locally
classifier = EmailClassifier()
