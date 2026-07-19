# OpenAI Build Week — Reference

Source: [openai.devpost.com](https://openai.devpost.com/) · [Resources](https://openai.devpost.com/resources) · [Rules](https://openai.devpost.com/rules) · [FAQs](https://openai.devpost.com/details/faqs)

Last reviewed: 2026-07-14

---

## Does Talkaroo qualify?

**As a product idea: yes (Education). Runtime stack is all Gemini; Codex + GPT-5.6 are the build agents.**

| Factor | Status |
| --- | --- |
| Track fit | **Education** — Korean conversation practice for learners |
| Existing project | Allowed if **meaningfully extended** during the submission window with Codex and/or GPT-5.6, with clear old-vs-new docs |
| Product runtime | Gemini Live (voice) + Gemini coach (HUD) via Vertex ADC |
| Codex + GPT-5.6 | Used to **build/refine** the app (frontend, architecture) — document in README + demo video |
| Codex Session ID | ⚠️ Still need `/feedback` Session ID for submission |

**Strategy:** Runtime is **Gemini only** (Live partner + coach) — no `OPENAI_API_KEY` in the product. Treat Codex/GPT-5.6 as the hackathon tooling (how you built). Highlight in the demo/README where Codex + GPT-5.6 accelerated UI and decisions. Confirm against current Official Rules before submit.

---

## What this hackathon is

Global online hackathon to build with **Codex** (coding agent) and **GPT-5.6**. Sponsor: OpenAI. Hosted on Devpost. ~$100k cash prizes + Pro accounts, DevDay passes, Codex team meetups, promotion.

You may start from scratch **or extend an existing project** — only work done in the submission window with Codex / GPT-5.6 counts.

---

## Key dates

| When | What |
| --- | --- |
| Jul 9 – Jul 21, 5:00 PM PT | Registration |
| **Jul 13 – Jul 21, 5:00 PM PT** | **Submission period** |
| **Jul 17, 12:00 PM PT** | **Deadline to request free Codex credits** |
| Jul 22 – ~Aug 5 | Judging |
| ~Aug 12 | Winners announced |

Credits: registered entrants can request **$100 Codex credits** (one per entrant; use by Jul 31). Form linked from the [Resources tab](https://openai.devpost.com/resources) / Official Rules. Overage charges are on you; leave Auto top-up off if you don’t want billing.

---

## Tracks (pick one)

1. **Apps for Your Life** — consumer / everyday life  
2. **Work & Productivity** — teams, workflows, ops  
3. **Developer Tools** — testing, DevOps, agents, security  
4. **Education** — AI for students, teachers, or education orgs ← **Talkaroo’s best fit**

One project = one track only.

---

## Required tools

Both are mandatory:

- **Codex** — build the project with it (ChatGPT app, CLI, IDE extension, or SDK)
- **GPT-5.6** — meaningfully used in the product (not decorative)

Proof expected:

- Demo video voiceover covering Codex **and** GPT-5.6
- README detailing how Codex accelerated work and how GPT-5.6 is used
- **`/feedback` Codex Session ID** from the primary build thread (run `/feedback` in that thread)

---

## What to submit

1. Working project  
2. One category/track  
3. Project description  
4. **Public YouTube demo &lt; 3 min** with **voiceover** (yours or AI TTS) covering: what you built + how you used Codex + how you used GPT-5.6. Music-only screencasts fail.  
5. Repo URL — public with a license, **or** private shared with `testing@devpost.com` and `build-week-event@openai.com`  
6. README: setup, sample data, how to run; plus Codex/GPT-5.6 collaboration story  
7. `/feedback` Session ID  
8. For plugins/dev tools: install steps, platforms, demo/sandbox/test account  

English (or English translations) required. No edits after the submission deadline.

### Pre-existing projects

Must document prior vs new work and show evidence of Codex and/or GPT-5.6 use during the Submission Period (timestamped session logs, dated commits, etc.). Judges evaluate only the new work.

---

## Judging (equal weight)

1. **Technological Implementation** — skilled Codex use; real, non-trivial code  
2. **Design** — complete product experience, not a thin PoC  
3. **Potential Impact** — real problem, real audience, solution matches demo  
4. **Quality of the Idea** — creative, informed about the problem space  

Stage 1: pass/fail (fits theme + required tools). Stage 2: score the four criteria.

---

## Prizes (per track)

- **1st:** $15k + up to 2 DevDay/Exchange passes (~$650 each) + OpenAI promo + meet Codex team + Pro for 1 year  
- **2nd:** $10k + promo + Pro for 1 year  

DevDay listed as Sep 29, 2026 (SF); travel not covered. One prize per project.

---

## Resources & tips (from Resources tab)

**Tools & setup**

- [OpenAI account](https://auth.openai.com/create-account)
- Request $100 Codex credits (Resources / Rules form; by Jul 17 noon PT)
- [GPT-5.6 background](https://openai.com/index/gpt-5-6/)
- [How to Choose a Model](https://learn.chatgpt.com/docs/models?surface=app)
- [Codex quickstart](https://learn.chatgpt.com/docs/quickstart)

**Community**

- Discord: `#build-week-chat`, `#hackathon-announcements`, `#office-hours` — [discord.gg/openai](https://discord.gg/openai)
- 60+ local ambassador events; virtual lineup at [openai.com/build-week](https://openai.com/build-week/)

**Pointers**

- Start from a real problem, not “use the model”
- Find teammates early (Participants tab / Discord)
- Record the demo as you go
- Make the repo easy to test (judges may not rebuild from scratch)
- Watch credit usage

**Optional:** [Devpost Hackathons Plugin](https://chatgpt.com/plugins/plugin_asdk_app_6a330a7730c081919892632d5baaec58) in Codex — handy for rules/submit flow; Official Rules always win if they conflict.

---

## Eligibility (high level)

Age of majority (or parent/guardian for minors); resident of OpenAI API–supported countries; not Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, Syria, or other OFAC-restricted places. Solo, team, or org OK.
