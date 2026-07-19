# Talkaroo design system — Calm Café Precision

Source of truth for visual craft. Landing and session should feel like one product.

## Personality

Warm, calm, conversation-first. Premium through restraint, type, and purposeful motion — not dark SaaS chrome or purple AI gradients.

## Color

| Token | Value | Use |
|-------|--------|-----|
| `--paper` | `#e7eef3` | App / page canvas |
| `--paper-deep` | `#d2dee8` | Depth washes, sidebar tint |
| `--ink` | `#14212b` | Primary text |
| `--muted` | `#5a6b78` | Secondary text |
| `--accent` | `#0f7a6c` | Actions, live status, coach labels |
| `--accent-2` | `#3aa89a` | Gradient companion for CTAs |
| `--accent-hot` | `#c45c26` | Rare emphasis / errors only |
| `--surface` | `rgba(255,255,255,0.78)` | Glass chrome |
| `--line` | `rgba(20,33,43,0.12)` | Hairlines |

Teal is the only action color. Terracotta is never a primary button.

## Typography

- **Display:** Fraunces — brand, section titles, scenario Korean titles
- **UI:** Manrope — chrome, body, English
- **Korean body:** Noto Sans KR — chat bubbles, Hangul titles

Scale (approx): body 15–16px · UI labels 0.65–0.72rem uppercase · display hero `clamp(3.75rem, 13vw, 7rem)`.

## Layout

- Landing: full-bleed café photo with scroll parallax; one promise + one CTA in the sticky viewport; Method / Stories / closing below the fold.
- Session (“conversation atelier”): glass scenario rail · luminous chat stage · inline coach under turns · floating pill composer.
- Atmosphere via soft teal aurora + faint grid (CSS only) — never dark chrome or purple AI glow.
- Cards only for interaction (bubbles, coach, scenario rows). No hero cards.

## Motion

- Duration 180–280ms for UI; scroll-scrub for landing hero.
- Landing below-fold follows the Luma scroll pattern (`Documents/codex/…/can`): top progress bar, sticky method title, `.reveal` → `.visible` via IntersectionObserver (~18% threshold), light parallax on quote visual.
- Session: message enter, coach fade/scale, live mic wave, speaking avatar ring, slow aura drift.
- Honor `prefers-reduced-motion` (collapse scroll height, skip decorative loops, force reveals visible).

## Do / don’t

**Do:** brand-first Talkaroo, generous whitespace, coaching under the utterance, quiet secondary auth links.

**Don’t:** dark-mode default, purple gradients, cream+newspaper clichés, stat strips, emoji decoration, model names as primary UI, competing CTAs in the first viewport.
