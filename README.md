# Inbox Concierge

AI-powered email triage that connects to your Gmail inbox, reads your last 200 threads, and classifies them into meaningful buckets using an LLM — so you see what actually matters instead of an undifferentiated list.

## Architecture

```
Browser (Vite + React)
    │
    │  /api/* (proxied in dev)
    ▼
Express server (port 3001)
    ├── Google OAuth2  ──────────────▶  Gmail API (metadata only)
    └── LLM classifier ──────────────▶  Claude / OpenAI / Gemini
```

The Express server handles all auth and LLM calls server-side — API keys and OAuth tokens never touch the browser. Vite's dev proxy forwards `/api/*` to `localhost:3001`.

## Setup

### 1. Google Cloud Console

1. Create a new project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Gmail API**: APIs & Services → Library → search "Gmail API" → Enable
3. Create OAuth credentials: APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
4. Add your Google account as a test user: APIs & Services → OAuth consent screen → Test users

### 2. Environment variables

Copy the `.env` file at the repo root and fill in:

```
GOOGLE_CLIENT_ID=        # From step 3 above
GOOGLE_CLIENT_SECRET=    # From step 3 above
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
LLM_PROVIDER=claude      # claude | openai | gemini
ANTHROPIC_API_KEY=       # Required if LLM_PROVIDER=claude
OPENAI_API_KEY=          # Required if LLM_PROVIDER=openai
GEMINI_API_KEY=          # Required if LLM_PROVIDER=gemini
SESSION_SECRET=          # Any random string
PORT=3001
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), click **Connect Gmail**, and authorize read-only access.

## Classification pipeline

Threads are classified in parallel batches of 25. Each batch is sent to the LLM with:
- All available bucket definitions (id, label, description)
- Thread metadata: sender, subject, snippet, date

The LLM returns a JSON array of `{ id, bucket, confidence, reason }` per thread. The pipeline:

1. **Validates** every response — checks that `bucket` is in the allowed set, `confidence` is 0–100, all required fields are present
2. **Retries** failed batches up to 2 times with exponential backoff before falling back
3. **Falls back per-thread**, not per-batch — a partial response is merged with fallback entries only for threads the LLM missed
4. **Logs** any fallback assignments with the thread IDs for auditing

Batch size of 25 balances prompt length (staying well under context limits) with the number of API round-trips needed for 200 threads (8 concurrent calls).

## Custom buckets and reclassification

Users can create custom buckets with a name and description (e.g. "Finance — invoices, billing, and expense receipts"). When a bucket is created, the full inbox is immediately reclassified by the LLM with the new bucket included in the available options. The LLM's semantic understanding means bucket descriptions drive classification, not keyword matching.

The standalone **Reclassify** button allows re-running classification at any time — useful after creating multiple buckets at once.

## LLM provider abstraction

Classification is backed by a `LLMProvider` interface with three implementations:

| Provider | Model | Set `LLM_PROVIDER=` |
|----------|-------|---------------------|
| Anthropic Claude | `claude-haiku-4-5-20251001` | `claude` |
| OpenAI | `gpt-4o-mini` | `openai` |
| Google Gemini | `gemini-2.0-flash` | `gemini` |

Switching providers requires only changing the `LLM_PROVIDER` env var — no code changes.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 8 |
| Backend | Express 4, express-session, TypeScript, tsx |
| Gmail integration | googleapis (Node.js client), p-limit for concurrency |
| LLM (default) | Anthropic Claude (`claude-haiku-4-5-20251001`) |
| Auth | Google OAuth 2.0, server-side session cookie |
