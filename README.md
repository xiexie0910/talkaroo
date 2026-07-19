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

**How Codex + GPT-5.6 were used:** dual-channel architecture, session/landing UI, Live bridge, coach & recap APIs, ASR turn-taking, level affordances, and prompt-boundary hardening. Demo voiceover should cover the product plus how Codex and GPT-5.6 accelerated the build. No `OPENAI_API_KEY` in the product.

## Stack

Next.js 16 · React 19 · Supabase · Vertex Gemini (`gemini-live-2.5-flash-native-audio` + `gemini-2.5-flash-lite`) · Zod · Vitest

## How it works

```
Mic → Gemini Live partner (audio + transcripts)
On-tap → Gemini coach HUD
End & reflect → short recap + next mission
```

Coaching is **on tap by level** (Beginner: Understand + Polish; Intermediate: Understand; Advanced: none) — voice never waits on the coach.
