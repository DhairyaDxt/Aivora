import { cn } from "@/lib/utils";

/** Small animated audio-bar visualization — a nod to the product being a
 *  voice AI. Each bar gets a slightly different delay/duration so the wave
 *  looks organic rather than mechanically synced. */
export function Waveform({
  bars = 5,
  active = true,
  className,
}: {
  bars?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex h-4 items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-0.5 rounded-full bg-gradient-to-t from-[var(--grad-from)] to-[var(--grad-to)] shadow-[0_0_6px_-1px_var(--glow)]",
            active && "waveform-bar",
          )}
          style={
            active
              ? {
                  height: "100%",
                  animationDelay: `${(i % 4) * 0.12}s`,
                  animationDuration: `${0.9 + (i % 3) * 0.15}s`,
                }
              : { height: "35%" }
          }
        />
      ))}
    </div>
  );
}
