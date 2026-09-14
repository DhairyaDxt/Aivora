import { Fragment, type ReactNode } from "react";

/** Infinite horizontal ticker. Renders two copies of `items` back to back
 *  and scrolls them left forever — the duplicate is what makes it loop
 *  without a visible seam. */
export function Marquee({ items }: { items: ReactNode[] }) {
  const row = (copy: "a" | "b") => (
    <div className="flex shrink-0 items-center" aria-hidden={copy === "b"}>
      {items.map((item, index) => (
        <Fragment key={`${copy}-${index}`}>
          <span className="px-6 py-3 whitespace-nowrap label-tag">{item}</span>
          <span className="text-[var(--grad-to)]">✦</span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-y border-white/[0.06] bg-white/[0.02]">
      <div className="flex w-max animate-marquee">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
