from fastapi import FastAPI

from app.routers import auth, gmail, inference

app = FastAPI(
    title="Mailiq - AI Email Intelligence Assistant",
    description="BiGRU multi-task email classifier (category + priority) with a RAG context lookup.",
    version="0.1.0",
)
app.include_router(inference.router, tags=["inference"])
app.include_router(auth.router)
app.include_router(gmail.router)


@app.get("/")
def root():
    return {"message": "Mailiq API. See /docs for interactive API documentation."}
