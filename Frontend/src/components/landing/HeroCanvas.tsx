import { Suspense, lazy, useEffect, useState } from "react";

// Code-split: three.js is ~150KB gzipped and must never sit in the critical
// path of first paint. It only downloads once we've decided the scene should
// actually run.
const HeroScene = lazy(() => import("./HeroScene"));

/** Small devices, reduced-motion users and machines without WebGL all skip the
 * scene entirely and keep the CSS gradient behind it. The check runs after
 * mount so SSR output stays identical for everyone. */
function useShouldRender3D() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
    // A coarse pointer with low core count is a good proxy for "phone that
    // will stutter", without sniffing user agents.
    const isLowPower =
      typeof navigator !== "undefined" &&
      typeof navigator.hardwareConcurrency === "number" &&
      navigator.hardwareConcurrency <= 4;

    if (prefersReducedMotion || isSmallScreen || isLowPower) return;

    let supportsWebGL = false;
    try {
      const canvas = document.createElement("canvas");
      supportsWebGL = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      supportsWebGL = false;
    }

    // Wait for an idle moment so the scene never competes with hydration.
    if (supportsWebGL) {
      const schedule =
        window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
      const handle = schedule(() => setEnabled(true));
      return () => {
        if (window.cancelIdleCallback && typeof handle === "number") {
          window.cancelIdleCallback(handle);
        } else {
          clearTimeout(handle as unknown as number);
        }
      };
    }
    return;
  }, []);

  return enabled;
}

export function HeroCanvas() {
  const enabled = useShouldRender3D();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Always-present backdrop: this is the whole visual on phones and for
          reduced-motion, and the base layer the particles sit over elsewhere. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,color-mix(in_srgb,var(--grad-from)_22%,transparent),transparent_70%)]" />
      <div className="absolute top-1/4 -left-24 size-[32rem] rounded-full bg-[var(--grad-from)]/20 blur-[120px]" />
      <div className="absolute -right-24 bottom-0 size-[28rem] rounded-full bg-[var(--grad-to)]/20 blur-[120px]" />

      {/* Offset to the right on wide screens: full-bleed behind the headline
          both hurt legibility and buried the object. Given its own space it
          reads as a thing sitting in the page. */}
      {enabled ? (
        <Suspense fallback={null}>
          <div className="absolute inset-0 lg:left-[42%] lg:-mt-10">
            <HeroScene />
          </div>
        </Suspense>
      ) : null}

      {/* Fade the scene into the page rather than cutting it off hard. */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
