import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

export type Stat = { label: string; value: string; sub?: string };

/** Grid of glass stat tiles. Each value counts up from 0 the moment it
 *  scrolls into view. */
export function StatGrid({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="glass hover-lift p-4 sm:p-5">
          <p className="label-tag">{stat.label}</p>
          <AnimatedNumber
            value={stat.value}
            className="text-gradient mt-1 block text-2xl font-bold"
          />
          {stat.sub ? <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
