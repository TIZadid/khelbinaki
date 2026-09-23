import { useReducedMotion } from "motion/react";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";

// three.js is ~150 KB, so it loads in its own chunk after the page is up, and
// never on Data Saver or where WebGL isn't there. The hero reads fine without it.
const Football3D = lazy(() => import("./Football3D"));

function canRender(): boolean {
  if (typeof window === "undefined" || typeof WebGLRenderingContext === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function HeroBall({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const [enabled, setEnabled] = useState(false);
  const fail = useCallback(() => setEnabled(false), []);

  useEffect(() => {
    if (!canRender()) return;
    // Let the headline paint first.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const id = idle(() => setEnabled(true));
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id);
  }, []);

  return (
    <div aria-hidden="true" className={className}>
      {enabled && (
        <Suspense fallback={null}>
          <Football3D reduce={reduce} onFail={fail} />
        </Suspense>
      )}
    </div>
  );
}
