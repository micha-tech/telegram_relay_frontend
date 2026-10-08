"use client";

import { useEffect } from "react";

export function ExperienceMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const updateScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const available = root.scrollHeight - window.innerHeight;
        const progress = available > 0 ? window.scrollY / available : 0;
        root.style.setProperty(
          "--page-progress",
          String(Math.min(1, Math.max(0, progress))),
        );
      });
    };

    const revealObserver = reducedMotion.matches
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("is-revealed");
              revealObserver?.unobserve(entry.target);
            }
          },
          { rootMargin: "0px 0px -8%", threshold: 0.12 },
        );

    document.querySelectorAll("[data-reveal]").forEach((element) => {
      if (reducedMotion.matches) element.classList.add("is-revealed");
      else revealObserver?.observe(element);
    });

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);

    return () => {
      cancelAnimationFrame(frame);
      revealObserver?.disconnect();
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      root.style.removeProperty("--page-progress");
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" aria-hidden="true">
        <span />
      </div>
    </>
  );
}
