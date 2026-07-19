"use client";

import Image from "next/image";

type HeroVisualProps = {
  /** 0–1 scroll progress through the sticky hero section */
  progress: number;
  reducedMotion: boolean;
};

/**
 * Full-bleed café photo. Scroll progress zooms/drifts the image (parallax).
 */
export function HeroVisual({ progress, reducedMotion }: HeroVisualProps) {
  const t = reducedMotion ? 0.35 : progress;
  const scale = 1.08 + t * 0.12;
  const y = t * -8;

  return (
    <div className="landing-hero-visual" aria-hidden>
      <div
        className="landing-hero-photo"
        style={{
          transform: `translate3d(0, ${y}%, 0) scale(${scale})`,
        }}
      >
        <Image
          src="/landing/cafe-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="landing-hero-img"
        />
      </div>
      {/* Soft tint so nav/copy stay readable without hiding the photo */}
      <div className="landing-hero-wash" />
    </div>
  );
}
