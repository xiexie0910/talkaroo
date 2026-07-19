"use client";

import Link from "next/link";

type LandingOverlayProps = {
  progress: number;
  reducedMotion: boolean;
};

/** Smooth 0→1 curve between two edges (for fade timing). */
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Fade a beat in, hold, then fade out across scroll progress. */
function beatVisibility(
  t: number,
  enter: number,
  full: number,
  exit: number,
  leave: number,
) {
  if (t < enter) return 0;
  if (t < full) return smoothstep(enter, full, t);
  if (t < exit) return 1;
  if (t < leave) return 1 - smoothstep(exit, leave, t);
  return 0;
}

/** Nav + hero copy that fades as the sticky hero scrolls. */
export function LandingOverlay({ progress, reducedMotion }: LandingOverlayProps) {
  const t = reducedMotion ? 0.72 : progress;

  const brand = reducedMotion ? 1 : beatVisibility(t, 0, 0.02, 0.14, 0.28);
  const story = reducedMotion ? 1 : beatVisibility(t, 0.22, 0.32, 0.48, 0.62);
  const cta = reducedMotion ? 1 : beatVisibility(t, 0.55, 0.68, 0.95, 1.05);
  const hint = reducedMotion ? 0 : 1 - smoothstep(0.02, 0.12, t);

  return (
    <div className="landing-overlay">
      <div className="landing-nav">
        <a className="landing-nav-mark" href="#landing-scroll">
          Talkaroo
        </a>
        <nav className="landing-nav-links" aria-label="Landing">
          <a href="#method">Method</a>
          <a href="#stories">Stories</a>
          <Link href="/login?next=/session">Sign in</Link>
        </nav>
        <Link href="/session" className="landing-nav-cta btn-primary-sm">
          Start practicing <span aria-hidden>↗</span>
        </Link>
      </div>

      <div className="landing-progress" aria-hidden>
        <div className="landing-progress-track">
          <div
            className="landing-progress-fill"
            style={{ transform: `scaleY(${reducedMotion ? 1 : progress})` }}
          />
        </div>
        <span className={progress < 0.33 ? "is-active" : undefined}>Enter</span>
        <span
          className={
            progress >= 0.33 && progress < 0.66 ? "is-active" : undefined
          }
        >
          Speak
        </span>
        <span className={progress >= 0.66 ? "is-active" : undefined}>Learn</span>
      </div>

      <div
        className="landing-beat landing-beat-brand"
        style={{
          opacity: brand,
          transform: `translate3d(0, ${(1 - brand) * 18}px, 0)`,
        }}
        aria-hidden={brand < 0.05}
      >
        <p className="landing-eyebrow">Korean conversation practice</p>
        <h1 className="brand-hero">Talkaroo</h1>
      </div>

      <div
        className="landing-beat landing-beat-story"
        style={{
          opacity: story,
          transform: `translate3d(0, ${(1 - story) * 28}px, 0)`,
        }}
        aria-hidden={story < 0.05}
      >
        <p className="landing-headline">
          Speak in a real scene.
          <span className="landing-headline-accent">
            {" "}
            Coaching under each line.
          </span>
        </p>
        <p className="landing-sub">
          Keep the conversation moving while words, reply ideas, and a more
          natural version appear where you need them.
        </p>
      </div>

      <div
        className="landing-beat landing-beat-cta"
        style={{
          opacity: cta,
          transform: `translate3d(0, ${(1 - cta) * 22}px, 0)`,
          pointerEvents: cta > 0.25 ? "auto" : "none",
        }}
        aria-hidden={cta < 0.05}
      >
        <div className="landing-cta">
          <Link href="/session" className="btn-primary btn-landing">
            Start practicing
          </Link>
          <p className="landing-hint">
            Live voice · scenarios · coaching under each line
          </p>
        </div>
      </div>

      <div
        className="landing-scroll-hint"
        style={{ opacity: hint }}
        aria-hidden={hint < 0.05}
      >
        <span>Scroll to continue</span>
        <span className="landing-scroll-chevron" />
      </div>
    </div>
  );
}
