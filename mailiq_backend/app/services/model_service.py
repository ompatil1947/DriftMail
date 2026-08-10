"""
Loads your trained BiGRU multi-task classifier from models/email_classifier/
(bigru_model.pt, vocab.pkl, model_config.pkl -- the three files your
notebook's final "save artifacts" cell produces). Falls back to a keyword
heuristic if those files aren't there yet, so the API is runnable and
testable before training finishes.

Preprocessing here is copied verbatim from the notebook (clean_text,
tokenize, encode) -- it must match exactly, or the vocabulary indices
won't line up with what the model was trained on.
"""
import os
import pickle
import re

MODEL_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "models", "email_classifier"
)

# Fallback defaults if model_config.pkl isn't present yet -- overwritten by
# the real config the moment a trained model is dropped in.
CATEGORIES = [
    "forum", "promotions", "social_media", "spam", "updates",
    "verify_code", "oportunities", "finance", "college",
]
PRIORITIES = ["high", "medium", "low"]


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
    def __init__(self):
        self.using_trained_model = os.path.isdir(MODEL_DIR) and {
            "bigru_model.pt", "vocab.pkl", "model_config.pkl"
        }.issubset(set(os.listdir(MODEL_DIR)))
        self._model = None
        self._word2idx = None
        self._config = None
        if self.using_trained_model:
            self._load()

    def _load(self):
        import torch

        from .model_architecture import BiGRUMultiTaskClassifier

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

    def _encode(self, text: str):
        pad_idx = self._config["pad_idx"]
        unk_idx = self._word2idx.get("<UNK>", 1)
        max_len = self._config["max_len"]
        tokens = tokenize(text)[:max_len]
        ids = [self._word2idx.get(t, unk_idx) for t in tokens]
        ids = ids + [pad_idx] * (max_len - len(ids))
        return ids

    def predict(self, subject: str, body: str):
        text = clean_text(f"{subject}. {body}")
        if self.using_trained_model:
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
        # Placeholder only, used until bigru_model.pt/vocab.pkl/model_config.pkl
        # are placed in models/email_classifier/.
        t = text
        if any(k in t for k in ["unsubscribe", "% off", "sale", "discount"]):
            category, conf = "promotions", 0.6
        elif any(k in t for k in ["hackathon", "internship", "shortlisted", "unstop", "internshala"]):
            category, conf = "oportunities", 0.6
        elif any(k in t for k in ["semester", "college", "faculty", "cgpa", "exam schedule"]):
            category, conf = "college", 0.55
        elif any(k in t for k in ["debited", "credited", "bank", "upi", "emi", "invoice"]):
            category, conf = "finance", 0.6
        elif any(k in t for k in ["verification code", "otp", "one-time"]):
            category, conf = "verify_code", 0.65
        elif any(k in t for k in ["win a prize", "click here", "free money", "congratulations"]):
            category, conf = "spam", 0.6
        elif any(k in t for k in ["liked your", "friends checked in", "notifications on"]):
            category, conf = "social_media", 0.55
        elif any(k in t for k in ["thread", "reply", "upvotes"]):
            category, conf = "forum", 0.5
        else:
            category, conf = "updates", 0.4

        priority = (
            "high"
            if any(k in t for k in ["urgent", "asap", "expire", "immediately", "deadline"])
            and category != "spam"  # don't let manufactured spam urgency count
            else ("medium" if category in {"updates", "forum", "college"} else "low")
        )
        return category, conf, priority, 0.5


classifier = EmailClassifier()
