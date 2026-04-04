# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start both Vite (port 5173) and Express (port 3001) concurrently
npm run dev:client    # Vite only
npm run dev:server    # Express only (tsx watch)
npm run build         # Type-check + production build
npm run lint          # ESLint
```

No test suite exists.

## Architecture

Full-stack app: Vite + React frontend + Express backend in the same repo. This is a product demo.

### Frontend (`src/`)
- **`src/App.tsx`** — main component, all UI and state. Uses two hooks:
  - `src/hooks/useAuth.ts` — calls `GET /api/auth/status` on mount; exposes `isAuthenticated`, `email`, `login()`, `logout()`
  - `src/hooks/useThreads.ts` — `fetchAndClassify(buckets)` fetches Gmail threads then classifies them; `reclassify(buckets)` re-classifies with updated bucket list
- When unauthenticated, falls back to mock data from `src/data/mockThreads.ts`
- Styling: Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`). Dark slate + emerald theme.

### Backend (`server/`)
- **`server/index.ts`** — Express app entry, session middleware, CORS, routes
- **`server/routes/auth.ts`** — Google OAuth2 routes (`/api/auth/google`, `/callback`, `/status`, logout)
- **`server/routes/gmail.ts`** — `GET /api/gmail/threads` — fetches last 200 Gmail threads
- **`server/routes/classify.ts`** — `POST /api/classify` — classifies threads via LLM
- **`server/lib/gmail.ts`** — Gmail API helpers using `googleapis`; fetches metadata only (subject/from/date headers + snippet)
- **`server/lib/classifier.ts`** — batches 25 threads per LLM call, builds prompt, parses JSON response, runs batches concurrently
- **`server/llm/`** — provider abstraction: `provider.ts` (interface), `claude.ts` / `openai.ts` / `gemini.ts` (implementations), `index.ts` (factory reads `LLM_PROVIDER` env var)

### Data Flow
1. User clicks "Connect Gmail" → redirected to `/api/auth/google` → OAuth dance → session cookie set
2. `useAuth` detects `isAuthenticated=true` → calls `fetchAndClassify(DEFAULT_BUCKETS)`
3. `useThreads` calls `GET /api/gmail/threads` → then `POST /api/classify` with threads + buckets
4. Server fetches Gmail threads (p-limit 20 concurrent), sends to LLM in batches of 25
5. LLM returns JSON array of `{ id, bucket, confidence, reason }` per thread
6. Frontend merges classifications onto Gmail thread data → rendered in 3-column layout

### Dev Proxy
Vite proxies `/api/*` → `http://localhost:3001`. OAuth redirect URI must be `http://localhost:3001/api/auth/google/callback` (not the Vite port).

## Environment Variables

Copy `.env` at the repo root and fill in:

```
GOOGLE_CLIENT_ID=        # From Google Cloud Console OAuth 2.0 credentials
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
LLM_PROVIDER=claude      # claude | openai | gemini
ANTHROPIC_API_KEY=
SESSION_SECRET=          # Any random string
PORT=3001
```

**Google Cloud Console setup:**
1. Create OAuth 2.0 Client ID (Web application)
2. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
3. Enable Gmail API in the project
