"use client";

import { useEffect, type RefObject } from "react";

/**
 * IntersectionObserver reveal — mirrors Documents/codex/can/script.js:
 * elements with `.reveal` get `.visible` when ~18% in view.
 */
export function useRevealOnScroll(
  root: RefObject<HTMLElement | null>,
  reducedMotion: boolean,
) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;

    const items = scope.querySelectorAll<HTMLElement>(".reveal");
    if (reducedMotion) {
      items.forEach((el) => el.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18 },
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [root, reducedMotion]);
}
