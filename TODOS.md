# TODOS

## Talkaroo product

### Mid-speech streaming HUD (Approach C)

**What:** Stream grammar tokens onto the HUD while the learner is still speaking (not only at turn end).

**Why:** Closest to the Jarvis “while speaking” fantasy; v1 ships utterance-synced HUD only.

**Context:** Dual-agent architecture already separates Realtime partner from coach. After turn-end HUD is stable and Korean ASR is trustworthy enough, upgrade timing to partial transcripts — keep the same coach JSON schema (`tokens`, `error_token_indices`). Watch latency/flicker; supersede/AbortController rules still apply.

**Effort:** L  
**Priority:** P2  
**Depends on:** Stable turn-end HUD + acceptable Korean Live `inputTranscription` for particles

### More scenarios (restaurant / bus / directions)

**What:** Add scenario records (partner prompt + starter line) beyond 일상 대화.

**Why:** Situational practice was the original product pitch; daily chat is the wedge, not the ceiling.

**Context:** Mirror `lib/scenarios/daily-chat.ts` per scenario; Realtime session mint selects by scenario id and locks that prompt in the client secret. Landing page can list scenarios once the session loop is solid. Do not expand until daily-chat HUD demo works.

**Effort:** M  
**Priority:** P2  
**Depends on:** Working daily-chat session + Realtime ephemeral token minting
