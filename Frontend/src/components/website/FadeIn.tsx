import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Plain CSS + IntersectionObserver reveal - deliberately NOT framer-motion's
 * `whileInView` here, because that bakes an `opacity:0` starting style into
 * server-rendered/static markup that only animates back in once JS runs.
 * The published site is static HTML with a small inline reveal script (see
 * website.server.ts's renderSiteToStaticFiles), not a hydrated React app, so
 * this same component needs to degrade safely with no JS at all: the inline
 * `style` below is only ever applied once IntersectionObserver has already
 * run, so plain server/static output renders fully visible by default.
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      // data-reveal marks this element for the published static site's small
      // companion reveal script (see website.server.ts) to find and animate
      // the exact same way, since there's no React running there to do it.
      data-reveal="true"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : `translateY(${y}px)`,
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}
