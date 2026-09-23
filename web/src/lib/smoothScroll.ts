import Lenis from "lenis";

// Smooth, weighted scrolling for mouse wheels and trackpads. Touch keeps the
// phone's native scrolling, and anyone who asks for reduced motion gets none of it.
let lenis: Lenis | null = null;

export function startSmoothScroll(): () => void {
  if (typeof window === "undefined" || lenis) return () => undefined;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  if (!window.matchMedia?.("(pointer: fine)").matches) return () => undefined;

  const instance = new Lenis({ duration: 1.1, anchors: { offset: -72 }, autoRaf: true });
  lenis = instance;
  return () => {
    instance.destroy();
    lenis = null;
  };
}

/** Jump or glide to a spot, going through Lenis when it's running so the two never fight. */
export function scrollToTarget(target: number | string, immediate = false) {
  if (lenis) {
    lenis.scrollTo(target, { immediate, force: true, offset: typeof target === "string" ? -72 : 0 });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target, behavior: immediate ? "instant" : "smooth" });
    return;
  }
  document.querySelector(target)?.scrollIntoView({ behavior: immediate ? "instant" : "smooth" });
}

/** Stops the page scrolling behind an open sheet or menu. */
export function lockScroll(locked: boolean) {
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.style.overflow = locked ? "hidden" : "";
}
