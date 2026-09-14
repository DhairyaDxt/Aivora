import { useEffect, useRef } from "react";

/** Radial glow that follows the mouse. Place inside a `relative` container;
 *  fills it via absolute positioning. Mutates CSS vars directly instead of
 *  React state so tracking the mouse never triggers a re-render. */
export function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;

    const handleMove = (event: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      node.style.opacity = "1";
    };
    const handleLeave = () => {
      node.style.opacity = "0";
    };

    parent.addEventListener("mousemove", handleMove);
    parent.addEventListener("mouseleave", handleLeave);
    return () => {
      parent.removeEventListener("mousemove", handleMove);
      parent.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return <div ref={ref} aria-hidden className="spotlight" />;
}
