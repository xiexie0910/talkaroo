# Talkaroo

Korean conversation practice with a **dual-channel coach**: Gemini Live (Vertex AI) stays in character for daily small talk, while a separate Gemini grammar coach fills a Learning HUD after each turn.

Built with **Codex + GPT-5.6** as the development agents ([OpenAI Build Week](OPENAI_BUILD_WEEK.md)); the runtime product stack is Google Gemini + **Supabase** (auth + Postgres).

## Setup

### 1. Google Cloud (Gemini)

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
gcloud config set project YOUR_PROJECT_ID
```

Enable the Vertex AI API (`aiplatform.googleapis.com`) on the project.

### 2. Supabase (auth + database)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the migration in [`supabase/migrations/20260719000000_init.sql`](supabase/migrations/20260719000000_init.sql).
3. Copy **Project URL** and **publishable** (or anon) key from **Project Settings → API**.
4. Under **Authentication → URL configuration**, add:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/confirm`

### 3. App env

```bash
cp .env.example .env.local
# set GOOGLE_CLOUD_PROJECT, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Sign up / Sign in** → **Start 일상 대화**.

## Architecture

```
Mic PCM (16 kHz) → POST /api/live/session/[id]/audio → Gemini Live (server)
Gemini Live → SSE /api/live/session/[id] → browser playback (24 kHz)
Final user transcript → POST /api/coach (Gemini) → Learning HUD
Auth cookie → Supabase Auth  ·  turns/coach → Postgres (RLS)
```

- Voice never waits for the coach. Coaching is **on tap by level** (Beginner: Understand + Polish; Intermediate: Understand only; Advanced: none) — nothing auto-fires after each turn.
- Models (Vertex): Live = `gemini-live-2.5-flash-native-audio`; coach = `gemini-2.5-flash-lite` (fastest structured JSON we measured). Override via `GEMINI_LIVE_MODEL` / `GEMINI_COACH_MODEL`.
- Vertex ADC credentials stay on the server (no Gemini key in the browser).
- Live bridge is **in-memory on one Node process** (local/`next start`). Do not horizontally scale `/api/live/*` without sticky sessions or an external Live proxy — SSE/audio will 404 on the wrong instance.
- Practice sessions, turns, and coach results are stored per user in Supabase with row-level security.

## Scripts

- `npm run dev` — local app
- `npm test` — Vitest
- `npm run typecheck` — TypeScript (`tsc --noEmit`)
- `npm run lint` — ESLint
- `npm run build` — production build

CI runs lint, typecheck, test, and build on every PR (see `.github/workflows/ci.yml`).

## ASR / turn-taking note

Live sessions bias input transcription to `ko-KR` and use a short silence window (`GEMINI_LIVE_SILENCE_MS`, default **900**) so the partner replies quickly after you finish. Raise it (up to **2000**) if mid-thought pauses get cut off. If ASR still drops particles (은/는, 이/가, 을/를) or mangles Hangul, use the text fallback bar for a clean coach take.
