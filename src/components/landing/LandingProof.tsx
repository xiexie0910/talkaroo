"use client";

/**
 * Below-fold landing: Method (sticky title) → Stories quote → closing CTA.
 * Reveal animations use the shared `.reveal` / `.visible` classes.
 */
import Link from "next/link";
import { useEffect, useRef } from "react";
import { scenarios } from "@/lib/scenarios";

type LandingProofProps = {
  reducedMotion: boolean;
};

const STEPS = [
  {
    n: "01",
    title: "Notice",
    body: "Meet useful words inside a live Korean turn — not an isolated flashcard list.",
  },
  {
    n: "02",
    title: "Speak",
    body: "Practice out loud in a real scene: daily chat, café, restaurant, or directions.",
  },
  {
    n: "03",
    title: "Remember",
    body: "Coaching stays under the line you just heard or said, so the next turn is easier.",
  },
] as const;

/**
 * Below-fold scroll narrative adapted from Documents/codex Luma demo:
 * sticky method title, reveal steps, quote band, closing CTA.
 */
export function LandingProof({ reducedMotion }: LandingProofProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const frame = frameRef.current;
    if (!frame) return;

    const onScroll = () => {
      const rect = frame.getBoundingClientRect();
      const view = window.innerHeight;
      const mid = rect.top + rect.height / 2;
      const offset = (mid - view / 2) * -0.08;
      frame.style.transform = `translateY(${offset}px)`;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion]);

  return (
    <>
      <section id="method" className="scroll-section method-section">
        <div className="method-sticky">
          <p className="kicker scroll-eyebrow">A better rhythm</p>
          <h2 className="method-title">
            Built for the
            <br />
            <em>way conversation works.</em>
          </h2>
          <p className="method-lede">
            Less textbook. More living with the language — one scene at a time.
          </p>
        </div>

        <div className="method-steps">
          {STEPS.map((step) => (
            <article key={step.n} className="method-step reveal">
              <span className="method-step-n">{step.n}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              <div className="method-step-visual" aria-hidden>
                <span lang="ko">
                  {step.n === "01" && "하루"}
                  {step.n === "02" && "말해 보세요"}
                  {step.n === "03" && "좀 바빴어요"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="stories" className="scroll-section quote-section">
        <div className="quote-visual" aria-hidden>
          <div className="quote-orb quote-orb-a" />
          <div className="quote-orb quote-orb-b" />
          <div className="quote-frame" ref={frameRef}>
            <div className="quote-bubble" lang="ko">
              안녕하세요! 오늘 하루 어땠어요?
            </div>
            <div className="quote-coach">
              <p>Words · You could say</p>
              <p lang="ko">좀 바빴어요</p>
            </div>
          </div>
        </div>
        <blockquote className="quote-block reveal">
          <span className="quote-mark" aria-hidden>
            “
          </span>
          <p>
            I stopped studying Korean and started{" "}
            <em>having a conversation in Korean.</em>
          </p>
          <footer>
            <span className="quote-avatar" aria-hidden>
              T
            </span>
            Coaching under every line · Talkaroo
          </footer>
        </blockquote>
      </section>

      <section id="start" className="scroll-section closing-section">
        <p className="kicker scroll-eyebrow reveal">Your first conversation is waiting</p>
        <h2 className="closing-title reveal">
          Make room for
          <br />
          <em>another language.</em>
        </h2>
        <div className="closing-chips reveal" aria-label="Scenarios">
          {scenarios.map((s) => (
            <span key={s.id} lang="ko">
              {s.titleKo}
            </span>
          ))}
        </div>
        <Link href="/session" className="btn-primary btn-landing closing-cta reveal">
          Start practicing <span aria-hidden>↗</span>
        </Link>
        <p className="closing-fine reveal">
          <Link href="/login?next=/session">Sign in</Link>
          <span aria-hidden> · </span>
          <Link href="/signup?next=/session">Create account</Link>
          <span aria-hidden> · </span>
          Five minutes. Yours to keep.
        </p>
      </section>
    </>
  );
}
