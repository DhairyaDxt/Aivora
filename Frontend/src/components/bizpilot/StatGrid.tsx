import { cn } from "@/lib/utils";

export type Stat = { label: string; value: string; sub?: string };

/** Grid of stat tiles sharing borders between cells, like a spec sheet. */
export function StatGrid({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-x divide-y divide-border border border-border md:grid-cols-4 md:divide-y-0",
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="p-4 sm:p-5">
          <p className="label-tag">{stat.label}</p>
          <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          {stat.sub ? <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
