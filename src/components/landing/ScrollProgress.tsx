"use client";

import { useEffect, useState } from "react";

/** Thin top bar: % of full page scrolled (hero + below-fold). */
export function ScrollProgress({ reducedMotion }: { reducedMotion: boolean }) {
  const [scrollRatio, setScrollRatio] = useState(0);
  const ratio = reducedMotion ? 1 : scrollRatio;

  useEffect(() => {
    if (reducedMotion) return;

    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setScrollRatio(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [reducedMotion]);

  return (
    <div className="scroll-progress" aria-hidden>
      <span style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}
