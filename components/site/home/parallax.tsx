"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/site-events";

// Floating sweets follow the mouse (desktop only, as in the prototype).
export function Parallax() {
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const floats = [...document.querySelectorAll<HTMLElement>("#ck-stage .ck-float")];
    const onMove = (event: PointerEvent) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      for (const float of floats) {
        const depth = Number(float.dataset.depth);
        float.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return null;
}
