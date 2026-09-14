import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { TiltCard } from "@/components/landing/TiltCard";
import { AnimatedNumber } from "@/components/aivora/AnimatedNumber";
import { cn } from "@/lib/utils";

/** KPI tile with real depth: it tilts toward the cursor, the icon plate sits
 * on a raised Z layer, and a sparkline runs along the bottom edge. */
export function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  delta,
  spark,
  footnote,
  delay = 0,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: LucideIcon;
  delta?: { value: number; positiveIsGood?: boolean } | undefined;
  spark?: number[] | undefined;
  footnote?: ReactNode;
  delay?: number;
}) {
  const positiveIsGood = delta?.positiveIsGood ?? true;
  const isUp = (delta?.value ?? 0) >= 0;
  const good = isUp === positiveIsGood;

  return (
    <TiltCard intensity={6} className="group h-full">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay }}
        className="glass relative h-full overflow-hidden rounded-2xl p-5"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <span
            className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] text-white shadow-[0_8px_20px_-8px_var(--glow)]"
            style={{ transform: "translateZ(28px)" }}
          >
            <Icon className="size-4" />
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-1" style={{ transform: "translateZ(18px)" }}>
          <span className="font-display text-3xl font-bold tabular-nums">
            <AnimatedNumber value={value} />
          </span>
          {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-medium tabular-nums",
                good
                  ? "bg-status-live/15 text-status-live"
                  : "bg-status-attention/15 text-status-attention",
              )}
            >
              {isUp ? "▲" : "▼"} {Math.abs(delta.value)}%
            </span>
          ) : null}
          {footnote ? <span className="text-muted-foreground">{footnote}</span> : null}
        </div>

        {spark && spark.length > 1 ? <Sparkline points={spark} /> : null}
      </motion.div>
    </TiltCard>
  );
}

/** Inline sparkline. Hand-rolled rather than pulling a chart lib in for
 * something this small - it's one path and a gradient fill. */
function Sparkline({ points }: { points: number[] }) {
  const width = 100;
  const height = 26;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const line = `M ${coords.join(" L ")}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  const gradientId = `spark-${points.join("-").slice(0, 24)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-4 h-8 w-full opacity-70 transition-opacity group-hover:opacity-100"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--grad-to)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--grad-to)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--grad-to)"
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
