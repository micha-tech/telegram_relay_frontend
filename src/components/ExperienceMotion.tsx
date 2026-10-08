"use client";

import { useEffect } from "react";

export function ExperienceMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    let pointerFrame = 0;
    let pointerX = 0;
    let pointerY = 0;

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

    const updatePointer = (event: PointerEvent) => {
      if (!finePointer.matches) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        root.style.setProperty("--pointer-x", `${pointerX}px`);
        root.style.setProperty("--pointer-y", `${pointerY}px`);
        pointerFrame = 0;
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
    window.addEventListener("pointermove", updatePointer, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pointerFrame);
      revealObserver?.disconnect();
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      window.removeEventListener("pointermove", updatePointer);
      root.style.removeProperty("--page-progress");
      root.style.removeProperty("--pointer-x");
      root.style.removeProperty("--pointer-y");
    };
  }, []);

  return (
    <>
      <div className="ambient-glow" aria-hidden="true" />
      <div className="scroll-progress" aria-hidden="true">
        <span />
      </div>
    </>
  );
}
