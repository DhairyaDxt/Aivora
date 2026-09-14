import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";
import { StatCard } from "@/components/dashboard/StatCard";
import { TiltCard } from "@/components/landing/TiltCard";
import { cn } from "@/lib/utils";
import {
  Activity,
  CheckCircle2,
  Clock,
  MessagesSquare,
  PhoneCall,
  MessageCircle,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Aivora" },
      {
        name: "description",
        content: "How your AI front desk is performing across every channel.",
      },
    ],
  }),
  component: Analytics,
});

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
] as const;

const CHANNEL_META: Record<string, { label: string; color: string; icon: typeof PhoneCall }> = {
  voice: { label: "Voice", color: "#6366f1", icon: PhoneCall },
  whatsapp: { label: "WhatsApp", color: "#22d3ee", icon: MessageCircle },
  website_chat: { label: "Website", color: "#a855f7", icon: Globe },
};

type ConversationRow = {
  id: string;
  channel: string | null;
  status: string | null;
  resolution_type: string | null;
  started_at: string | null;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function Analytics() {
  const { data: org } = useOrg();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("30");
  const days = Number(range);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", org?.id, range],
    enabled: !!org?.id,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

      const [{ data: conversations }, { data: callLogs }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id, channel, status, resolution_type, started_at")
          .eq("org_id", org!.id)
          .eq("is_sandbox", false)
          .gte("started_at", since)
          .order("started_at", { ascending: true }),
        supabase
          .from("call_logs")
          .select("duration_seconds, outcome, cost_usd, created_at")
          .gte("created_at", since),
      ]);

      return {
        conversations: (conversations ?? []) as ConversationRow[],
        callLogs: callLogs ?? [],
      };
    },
  });

  const derived = useMemo(() => {
    const conversations = data?.conversations ?? [];
    const callLogs = data?.callLogs ?? [];

    // Daily series, zero-filled so gaps render as gaps rather than collapsing.
    const buckets = new Map<
      string,
      { date: string; total: number; voice: number; whatsapp: number }
    >();
    for (let i = days - 1; i >= 0; i--) {
      const day = startOfDay(new Date(Date.now() - i * 24 * 3600 * 1000));
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, { date: key, total: 0, voice: 0, whatsapp: 0 });
    }
    for (const conversation of conversations) {
      if (!conversation.started_at) continue;
      const key = conversation.started_at.slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (conversation.channel === "voice") bucket.voice += 1;
      if (conversation.channel === "whatsapp") bucket.whatsapp += 1;
    }
    const series = Array.from(buckets.values());

    // Channel mix
    const channelCounts = new Map<string, number>();
    for (const conversation of conversations) {
      const channel = conversation.channel ?? "voice";
      channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);
    }
    const channelMix = Array.from(channelCounts.entries()).map(([channel, value]) => ({
      channel,
      label: CHANNEL_META[channel]?.label ?? channel,
      color: CHANNEL_META[channel]?.color ?? "#64748b",
      value,
    }));

    // Busiest hours
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    for (const conversation of conversations) {
      if (!conversation.started_at) continue;
      const hour = new Date(conversation.started_at).getHours();
      hours[hour]!.count += 1;
    }
    const peakHour = hours.reduce(
      (best, current) => (current.count > best.count ? current : best),
      hours[0]!,
    );

    const durations = callLogs
      .map((log) => log.duration_seconds)
      .filter((value): value is number => typeof value === "number" && value > 0);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0;

    const resolved = conversations.filter(
      (c) => c.resolution_type === "ai_resolved" || c.status === "resolved",
    ).length;
    const resolutionRate = conversations.length
      ? Math.round((resolved / conversations.length) * 100)
      : 0;

    const escalated = conversations.filter(
      (c) => c.status === "escalated" || c.resolution_type === "human_handoff",
    ).length;

    // Split the window in half to get a period-over-period delta.
    const midpoint = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, midpoint).reduce((sum, d) => sum + d.total, 0);
    const secondHalf = series.slice(midpoint).reduce((sum, d) => sum + d.total, 0);
    const trend =
      firstHalf === 0
        ? secondHalf > 0
          ? 100
          : 0
        : Math.round(((secondHalf - firstHalf) / firstHalf) * 100);

    return {
      series,
      channelMix,
      hours,
      peakHour,
      avgDuration,
      resolutionRate,
      escalated,
      total: conversations.length,
      trend,
      spark: series.map((d) => d.total),
    };
  }, [data, days]);

  const maxHour = Math.max(...derived.hours.map((h) => h.count), 1);

  return (
    <div className="relative overflow-hidden px-6 py-10 md:px-10 md:py-14">
      <AuroraBackground />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel index={3}>Analytics</SectionLabel>
          <h1 className="mt-2 text-3xl font-bold">How it's performing</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Every conversation across every channel, and what happened in them.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
          {RANGES.map((option) => {
            const isActive = option.id === range;
            return (
              <button
                key={option.id}
                onClick={() => setRange(option.id)}
                className={cn(
                  "relative rounded-full px-3.5 py-1.5 font-medium transition-colors",
                  isActive ? "text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="range-pill"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-[var(--grad-from)] to-[var(--grad-to)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <span className="relative">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI row */}
      <div className="relative mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Conversations"
          value={String(derived.total)}
          icon={MessagesSquare}
          delta={{ value: derived.trend }}
          spark={derived.spark}
          footnote={`last ${days} days`}
          delay={0}
        />
        <StatCard
          label="Resolved by AI"
          value={String(derived.resolutionRate)}
          suffix="%"
          icon={CheckCircle2}
          footnote={`${derived.escalated} needed a human`}
          delay={0.08}
        />
        <StatCard
          label="Avg call length"
          value={
            derived.avgDuration
              ? `${Math.floor(derived.avgDuration / 60)}:${String(derived.avgDuration % 60).padStart(2, "0")}`
              : "0:00"
          }
          icon={Clock}
          footnote="minutes per call"
          delay={0.16}
        />
        <StatCard
          label="Busiest hour"
          value={`${derived.peakHour.hour}`}
          suffix=":00"
          icon={Activity}
          footnote={`${derived.peakHour.count} conversations`}
          delay={0.24}
        />
      </div>

      {/* Volume + channel mix */}
      <div className="relative mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <TiltCard intensity={3} glare={false}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass h-full rounded-2xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Conversation volume</h2>
                <p className="text-sm text-muted-foreground">Daily, across all channels</p>
              </div>
            </div>

            <div className="mt-6 h-64">
              {isLoading ? (
                <div className="size-full animate-pulse rounded-xl bg-white/[0.04]" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={derived.series}
                    margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
                  >
                    <defs>
                      <linearGradient id="volume-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--grad-to)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--grad-to)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickFormatter={(value: string) => value.slice(5)}
                      minTickGap={24}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      allowDecimals={false}
                      width={40}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--grad-to)", strokeOpacity: 0.3 }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="var(--grad-to)"
                      strokeWidth={2}
                      fill="url(#volume-fill)"
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>
        </TiltCard>

        <TiltCard intensity={4} glare={false}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="glass h-full rounded-2xl p-6"
          >
            <h2 className="font-semibold">Channel mix</h2>
            <p className="text-sm text-muted-foreground">Where they came from</p>

            {derived.channelMix.length === 0 ? (
              <p className="mt-10 text-center text-sm text-muted-foreground">
                No conversations in this period yet.
              </p>
            ) : (
              <>
                <div className="mt-4 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={derived.channelMix}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="62%"
                        outerRadius="92%"
                        paddingAngle={3}
                        stroke="none"
                        animationDuration={800}
                      >
                        {derived.channelMix.map((entry) => (
                          <Cell key={entry.channel} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-2">
                  {derived.channelMix.map((entry) => {
                    const Icon = CHANNEL_META[entry.channel]?.icon ?? MessagesSquare;
                    const percent = Math.round((entry.value / derived.total) * 100);
                    return (
                      <div key={entry.channel} className="flex items-center gap-3 text-sm">
                        <Icon className="size-4" style={{ color: entry.color }} />
                        <span className="flex-1">{entry.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {entry.value} · {percent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </TiltCard>
      </div>

      {/* Hour heat strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.26 }}
        className="glass relative mt-6 rounded-2xl p-6"
      >
        <h2 className="font-semibold">When your customers get in touch</h2>
        <p className="text-sm text-muted-foreground">
          Conversations by hour of day — useful for deciding your opening hours.
        </p>

        <div className="mt-6 flex items-end gap-1">
          {derived.hours.map((bucket, index) => {
            const intensity = bucket.count / maxHour;
            return (
              <motion.div
                key={bucket.hour}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.012, ease: "easeOut" }}
                style={{ transformOrigin: "bottom" }}
                className="group relative flex-1"
                title={`${bucket.hour}:00 — ${bucket.count}`}
              >
                <div
                  className="w-full rounded-sm transition-all group-hover:brightness-150"
                  style={{
                    height: `${Math.max(6, intensity * 90)}px`,
                    background:
                      intensity > 0
                        ? `linear-gradient(to top, var(--grad-from), var(--grad-to))`
                        : "rgba(255,255,255,0.05)",
                    opacity: intensity > 0 ? 0.35 + intensity * 0.65 : 1,
                  }}
                />
              </motion.div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>12am</span>
          <span>6am</span>
          <span>12pm</span>
          <span>6pm</span>
          <span>11pm</span>
        </div>
      </motion.div>
    </div>
  );
}
