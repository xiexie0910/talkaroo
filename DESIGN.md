# Talkaroo design system — Calm Café Precision

Source of truth for visual craft. Landing, session, and auth should feel like one product.

## Personality

Warm, calm, conversation-first. Premium through restraint, type, and purposeful motion — not dark SaaS chrome or purple AI gradients.

## Color

| Token | Value | Use |
|-------|--------|-----|
| `--paper` | `#e7eef3` | App / page canvas |
| `--paper-deep` | `#d2dee8` | Depth washes |
| `--ink` | `#14212b` | Primary text |
| `--muted` | `#5a6b78` | Secondary text |
| `--accent` | `#0f7a6c` | Actions, kickers, live status |
| `--accent-2` | `#3aa89a` | Gradient companion for CTAs |
| `--accent-deep` | `#0b5f54` | Photo-hero contrast, live mic text |
| `--accent-hot` | `#c45c26` | Errors / rare emphasis only |
| `--surface` | `rgba(255,255,255,0.78)` | Glass chrome bars & panels |
| `--surface-rail` | `rgba(244,248,251,0.72)` | Session sidebar |
| `--line` | `rgba(20,33,43,0.12)` | Hairlines |

Teal is the only action color. Terracotta is never a primary button.

## Shared chrome (use these classes)

| Class | Role |
|-------|------|
| `.brand-mark` | Fraunces Talkaroo wordmark + ink→teal gradient; link home in product pages |
| `.kicker` | Uppercase label · 0.64rem · 0.12em · `--accent` |
| `.glass-panel` | Frosted surface + soft radius + soft shadow |
| `.btn-primary` / `.btn-primary-sm` | Teal gradient pills |
| `.btn-secondary` | Outline pills (same radius as primary) |

Landing photo nav (`.landing-nav-mark`) may stay contrast-adapted for the café image. Product pages use `.brand-mark`.

## Typography

- **Display:** Fraunces — brand, section titles, scenario Korean titles
- **UI:** Manrope — chrome, body, English
- **Korean body:** Noto Sans KR — chat bubbles, Hangul titles

Scale (approx): body 15–16px · kickers 0.64rem uppercase · display hero `clamp(3.75rem, 13vw, 7rem)`.

## Layout

- Landing: full-bleed café photo with scroll parallax; one promise + one CTA in the sticky viewport; Method / Stories / closing below the fold. Nav CTA uses the same teal primary as session.
- Session (“conversation atelier”): glass scenario rail · luminous chat stage · inline coach under turns · floating pill composer.
- Auth: same aurora canvas + glass panel as session chrome; soft rounded inputs.
- Spacing: 8px rhythm; chrome stays thin so content owns the viewport.
- Atmosphere via soft teal aurora + faint grid (CSS only) — never dark chrome or purple AI glow.
- Cards only for interaction (bubbles, coach, scenario rows, list rows). No hero cards.

## Motion

- Duration 180–280ms for UI; scroll-scrub for landing hero.
- Landing below-fold: top progress bar, sticky method title, `.reveal` → `.visible`.
- Session: message enter, coach fade/scale, live mic wave, speaking avatar ring, slow aura drift.
- Honor `prefers-reduced-motion`.

## Do / don’t

**Do:** brand-first Talkaroo, shared kickers/buttons/glass, coaching under the utterance, quiet secondary auth links.

**Don’t:** dark-mode default, purple gradients, cream+newspaper clichés, stat strips, emoji decoration, model names as primary UI, competing CTAs in the first viewport, one-off brand/button styles per page.
