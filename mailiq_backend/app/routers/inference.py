from fastapi import APIRouter

from app.schemas.email_schema import EmailInput, EmailPrediction
from app.services import rag_service
from app.services.model_service import classifier

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "using_trained_model": classifier.using_trained_model}


@router.post("/predict", response_model=EmailPrediction)
def predict(email: EmailInput):
    category, category_conf, priority, priority_conf = classifier.predict(
        email.subject, email.body
    )
    context_note = rag_service.get_context(category)
    return EmailPrediction(
        category=category,
        category_confidence=category_conf,
        priority=priority,
        priority_confidence=priority_conf,
        context_note=context_note,
    )
