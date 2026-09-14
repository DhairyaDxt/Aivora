import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { StatGrid } from "@/components/aivora/StatGrid";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";

export const Route = createFileRoute("/_authenticated/dashboard/usage")({
  head: () => ({
    meta: [
      { title: "Usage — Aivora" },
      {
        name: "description",
        content: "Call volume and cost over time for your voice receptionist.",
      },
      { property: "og:title", content: "Usage — Aivora" },
      { property: "og:description", content: "Call volume and cost over time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Usage,
});

type CallRow = {
  started_at: string | null;
  is_sandbox: boolean;
  call_logs: Array<{ duration_seconds: number | null; cost_usd: number | null }>;
};

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayLabel(key: string) {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const callsChartConfig = {
  calls: { label: "Calls", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

const costChartConfig = {
  cost: { label: "Cost", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

function Usage() {
  const { data: org } = useOrg();
  const [days, setDays] = useState<number>(30);

  const { data: rows = [] } = useQuery({
    queryKey: ["usage", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("started_at, is_sandbox, call_logs(duration_seconds, cost_usd)")
        .eq("org_id", org!.id)
        .eq("channel", "voice")
        .eq("is_sandbox", false)
        .order("started_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data as unknown as CallRow[];
    },
  });

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }, [days]);

  const inRange = useMemo(
    () => rows.filter((r) => r.started_at && new Date(r.started_at) >= since),
    [rows, since],
  );

  const { callsByDay, costByDay, totals } = useMemo(() => {
    const byDay = new Map<string, { calls: number; seconds: number; cost: number }>();
    let totalSeconds = 0;
    let totalCost = 0;

    for (const row of inRange) {
      if (!row.started_at) continue;
      const key = dayKey(row.started_at);
      const log = row.call_logs?.[0];
      const seconds = log?.duration_seconds ?? 0;
      const cost = log?.cost_usd ?? 0;
      const entry = byDay.get(key) ?? { calls: 0, seconds: 0, cost: 0 };
      entry.calls += 1;
      entry.seconds += seconds;
      entry.cost += cost;
      byDay.set(key, entry);
      totalSeconds += seconds;
      totalCost += cost;
    }

    const sortedKeys = Array.from(byDay.keys()).sort();
    const callsByDay = sortedKeys.map((key) => ({
      day: dayLabel(key),
      calls: byDay.get(key)!.calls,
    }));
    const costByDay = sortedKeys.map((key) => ({
      day: dayLabel(key),
      cost: Math.round(byDay.get(key)!.cost * 100) / 100,
    }));

    return {
      callsByDay,
      costByDay,
      totals: {
        calls: inRange.length,
        minutes: Math.round(totalSeconds / 60),
        cost: totalCost,
        avgCost: inRange.length > 0 ? totalCost / inRange.length : 0,
      },
    };
  }, [inRange]);

  return (
    <div className="relative overflow-hidden px-6 py-8 md:px-10">
      <AuroraBackground />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionLabel index={1}>Usage</SectionLabel>
            <h1 className="mt-2 text-2xl font-bold">Calls & cost</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Call volume and cost for your voice receptionist. Test calls are excluded.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {RANGES.map((r) => (
              <Button
                key={r.days}
                size="sm"
                variant={days === r.days ? "default" : "ghost"}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        <StatGrid
          className="mt-6"
          stats={[
            { label: "Calls", value: String(totals.calls), sub: `Last ${days} days` },
            { label: "Minutes talked", value: String(totals.minutes) },
            { label: "Total cost", value: `$${totals.cost.toFixed(2)}` },
            { label: "Avg. cost / call", value: `$${totals.avgCost.toFixed(3)}` },
          ]}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="panel p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Calls per day</h2>
            {callsByDay.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No calls in this range yet.
              </p>
            ) : (
              <ChartContainer config={callsChartConfig} className="mt-2 aspect-auto h-64 w-full">
                <BarChart
                  key={JSON.stringify(callsByDay)}
                  data={callsByDay}
                  margin={{ left: 0, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} />
                  <Bar
                    dataKey="calls"
                    fill="var(--color-calls)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Cost per day</h2>
            {costByDay.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No cost data in this range yet.
              </p>
            ) : (
              <ChartContainer config={costChartConfig} className="mt-2 aspect-auto h-64 w-full">
                <BarChart
                  key={JSON.stringify(costByDay)}
                  data={costByDay}
                  margin={{ left: 0, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel={false}
                        formatter={(value) => `$${Number(value).toFixed(3)}`}
                      />
                    }
                  />
                  <Bar
                    dataKey="cost"
                    fill="var(--color-cost)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Cost figures come from Vapi's per-call cost report and may take a moment to appear after a
          call ends.
        </p>
      </div>
    </div>
  );
}
