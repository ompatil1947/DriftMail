# Mailiq backend

FastAPI backend wrapping your trained BiGRU email classifier (category +
priority) with a lightweight RAG context lookup for `college`,
`oportunities`, and `finance`.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Deploy your trained model

Copy these three files from your Colab notebook's `artifacts/` folder into
`models/email_classifier/` here:
- `bigru_model.pt`
- `vocab.pkl`
- `model_config.pkl`

Until they're present, `/predict` runs on a keyword heuristic fallback
(`using_trained_model: false` in `/health`), so the API is fully testable
before you've finished training.

## Gmail OAuth setup

Do the Google Cloud Console steps first (create project, enable Gmail API,
configure the OAuth consent screen with the `gmail.readonly` scope, add
yourself as a test user, create a Web application OAuth client with
`http://localhost:8000/auth/google/callback` as an authorized redirect URI).

Then fill in the three Google values in `.env` (already gitignored) with
what the console gave you:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

**Connect your Gmail:** with the server running, visit
`http://localhost:8000/auth/google/login` in a browser (not `/docs` -- this
one needs to be a real browser tab so Google's consent screen can redirect
back to `/auth/google/callback`). Approve access, and you'll land back on a
confirmation page (or your `FRONTEND_URL`, if you set one).

Tokens are stored in `data/gmail_tokens.json` (gitignored) -- fine for this
single-user personal project. `GET /auth/google/status` tells you if a
connection is currently on file; `POST /auth/google/disconnect` clears it.

**Testing-mode 7-day expiry:** while your OAuth consent screen's publishing
status is "Testing," Google expires the refresh token after 7 days no
matter what. When that happens, `GET /gmail/inbox` returns `401` with
`error_code: RECONNECT_REQUIRED` -- send the user back through
`/auth/google/login` rather than treating it as a bug.

## Run

```bash
uvicorn app.main:app --reload
```

Interactive docs: `http://127.0.0.1:8000/docs`

## API

`GET /health` -> `{"status": "ok", "using_trained_model": bool}`

`GET /auth/google/login` -> redirects to Google's consent screen

`GET /auth/google/status` -> `{"connected": bool, "expires_at": float | null}`

`POST /auth/google/disconnect` -> `{"disconnected": true}`

`GET /gmail/inbox?max_results=10` -> classifies your N most recent inbox
emails, returns a list of `InboxEmailPrediction` (id, sender, date, snippet,
category, category_confidence, priority, priority_confidence, context_note).
`401` with `error_code: RECONNECT_REQUIRED` if Gmail isn't connected or the
token has expired.

`POST /predict`
```json
{"subject": "Fee payment reminder", "body": "Your semester fee is due tomorrow."}
```
->
```json
{
  "category": "college",
  "category_confidence": 0.91,
  "priority": "high",
  "priority_confidence": 0.83,
  "context_note": "Institutional email ranges from truly time-sensitive..."
}
```

## Architecture

`app/services/model_architecture.py` defines the exact same
`BiGRUMultiTaskClassifier` used in training -- one embedding layer, one
bidirectional GRU, two linear heads sharing the encoder (category +
priority). `model_service.py` loads the saved weights, vocab, and config,
and reuses the identical `clean_text`/`tokenize`/`encode` preprocessing
from the notebook -- this must match exactly, since the vocabulary
indices only mean what they mean relative to how the model was trained.

`rag_service.py` implements the optional enhancement: a category-based
lookup over `data/knowledge_base/*.md`, attached to the response only for
categories that benefit from extra context.

## Deployment

Render, Railway, Fly.io, or Hugging Face Spaces (free tier). Use CPU-only
torch (already in requirements.txt) to keep the image small.
