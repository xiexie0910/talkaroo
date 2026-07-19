# Frontend map (for maintainers)

## Pages

| Route | What it does |
|-------|----------------|
| `/` | Marketing landing — photo hero + scroll sections |
| `/session` | Live practice — scenarios, chat, inline coach |
| `/login`, `/signup` | Auth forms |
| `/history` | Past practice sessions |

## Session (most of the logic)

- `SessionClient.tsx` — connects mic + Live SSE, runs coach, owns UI state
- `PartnerPane.tsx` — chat thread + scroll
- `InlineCoachCard.tsx` — coaching under a turn
- `ScenarioSidebar.tsx` — pick scenario + level
- `lib/session/level.ts` — which coach modes run for beginner / intermediate / advanced
- `lib/live/*` + `app/api/live/*` — Gemini Live bridge (server holds credentials)

**Level does not change the partner voice prompt** — only how much coaching we show/call.

## Landing (visual only)

- `landing/LandingExperience.tsx` — sticky hero scroll + below-fold sections
- `landing/HeroVisual.tsx` — café photo + parallax
- `landing/LandingOverlay.tsx` — nav + hero copy fades
- `landing/LandingProof.tsx` — Method / Stories / closing CTA
- `hooks/useRevealOnScroll.ts` — fade-in cards on scroll
- `hooks/usePrefersReducedMotion.ts` — accessibility

Styles live in `app/globals.css` (search for `.landing-` / `.session-` / `.chat-`).
