# Talkaroo

Korean conversation practice with a **dual-channel** design:

- **Partner** — Gemini Live (Vertex AI) stays in character across café, restaurant, directions, and daily chat
- **Coach** — a separate Gemini model fills an on-tap Learning HUD (Understand / Polish by learner level)

Practice a scene → speak Korean → tap **Understand** or **Polish** when you want help → **End & reflect** for a short win, focus phrase, and next mission.

## OpenAI Build Week

| | |
| --- | --- |
| **Hackathon** | [OpenAI Build Week](https://openai.devpost.com/) · submission **Jul 13 – Jul 21, 2026, 5:00 PM PT** |
| **Track** | **Education** |
| **Runtime** | Gemini Live + Gemini coach/recap (Vertex) · Supabase auth/Postgres |
| **Build agents** | **Codex** + **GPT-5.6** — used to design and ship the app (not called at runtime) |
| **Codex Session ID** | _add `/feedback` ID from the primary build thread before submit_ |

Talkaroo does **not** call OpenAI models in production. There is no `OPENAI_API_KEY` in the product.

### How Codex and GPT-5.6 were used

**GPT-5.6** shaped the product:

- Education-track thesis: practice for people *using* Korean in real life, not another flashcard wrapper
- Dual-channel design — live partner stays immersive; coaching only appears on tap
- Frontend and landing direction: session UI, level affordances, scroll narrative

**Codex** shipped the working product:

- Dual-channel architecture end to end: Live voice partner + on-tap coach/recap APIs
- Browser → WebSocket bridge → Gemini Live (mic capture, PCM resampling, playback, turn-taking)
- Session UI, ASR merge with Live captions, level-gated Understand / Polish
- Prompt-boundary hardening, schemas, tests, and the thin loop: speak → hear → understand → polish → reflect

## Stack

Next.js 16 · React 19 · Tailwind · Supabase · Vertex Gemini (`gemini-live-2.5-flash-native-audio` + `gemini-2.5-flash-lite`) · Zod · Vitest · Vercel

## How it works

```
Mic → Gemini Live partner (audio + transcripts)
On-tap → Gemini coach HUD
End & reflect → short recap + next mission
```

Mic audio is resampled to PCM and sent over a WebSocket bridge to Gemini Live. Audio and transcripts return the same way. Browser Korean ASR is merged with Live transcription for snappier captions. Coaching is a second Gemini model, called only on Understand / Polish — voice never waits on the coach.

Coaching by level: Beginner (Understand + Polish) · Intermediate (Understand) · Advanced (none).
