/** Two large, slowly-drifting blurred gradient orbs behind hero-type
 *  sections. Parent needs `relative overflow-hidden`. Purely decorative. */
export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="aurora-blob -left-32 -top-32 size-[32rem] bg-[var(--grad-from)]"
        style={{ animationDelay: "0s" }}
      />
      <div
        className="aurora-blob -right-24 top-10 size-[28rem] bg-[var(--grad-to)]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="aurora-blob bottom-[-10rem] left-1/3 size-[24rem] bg-[var(--grad-via)] opacity-40"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}
