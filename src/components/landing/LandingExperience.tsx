"use client";

/**
 * Landing page shell:
 * 1) Sticky hero (photo + overlay) scrubbed by scroll
 * 2) Below-fold Method / Stories / CTA sections
 */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import { HeroVisual } from "./HeroVisual";
import { LandingOverlay } from "./LandingOverlay";
import { LandingProof } from "./LandingProof";
import { ScrollProgress } from "./ScrollProgress";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function LandingExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useRevealOnScroll(rootRef, reducedMotion);

  // Drive hero parallax + overlay fades from this section only
  useGSAP(
    () => {
      if (reducedMotion) {
        setProgress(0.55);
        return;
      }

      const st = ScrollTrigger.create({
        trigger: scrollRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.65,
        onUpdate: (self) => setProgress(self.progress),
      });

      return () => st.kill();
    },
    { scope: scrollRef, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className="landing-root">
      {/* Full-page bar (separate from hero progress — includes below-fold) */}
      <ScrollProgress reducedMotion={reducedMotion} />

      <section
        ref={scrollRef}
        id="landing-scroll"
        className="landing-scroll"
        aria-label="Talkaroo introduction"
      >
        <div className="landing-sticky">
          <div className="landing-hero-wrap">
            <HeroVisual progress={progress} reducedMotion={reducedMotion} />
          </div>
          <div className="landing-scrim" aria-hidden />
          <LandingOverlay progress={progress} reducedMotion={reducedMotion} />
        </div>
      </section>

      <LandingProof reducedMotion={reducedMotion} />
    </div>
  );
}
