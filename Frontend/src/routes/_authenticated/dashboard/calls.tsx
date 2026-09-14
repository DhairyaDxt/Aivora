import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { StatGrid } from "@/components/aivora/StatGrid";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";

export const Route = createFileRoute("/_authenticated/dashboard/calls")({
  head: () => ({
    meta: [
      { title: "Calls — Aivora" },
      {
        name: "description",
        content: "Read transcripts and listen back to calls your receptionist handled.",
      },
      { property: "og:title", content: "Calls — Aivora" },
      { property: "og:description", content: "Transcripts and recordings from your receptionist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Calls,
});

type CallLog = {
  id: string;
  transcript: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  summary: string | null;
};

type CallRow = {
  id: string;
  customer_identifier: string | null;
  started_at: string | null;
  is_sandbox: boolean;
  resolution_type: string | null;
  status: string | null;
  call_logs: CallLog[];
};

function duration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function Calls() {
  const { data: org } = useOrg();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["calls", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, customer_identifier, started_at, is_sandbox, resolution_type, status, call_logs(id, transcript, recording_url, duration_seconds, outcome, summary)",
        )
        .eq("org_id", org!.id)
        .eq("channel", "voice")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as CallRow[];
    },
  });

  const realCalls = useMemo(() => rows.filter((r) => !r.is_sandbox), [rows]);

  const stats = useMemo(() => {
    const durations = realCalls
      .map((r) => r.call_logs?.[0]?.duration_seconds ?? null)
      .filter((d): d is number => d != null);
    const avg = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
    const escalated = realCalls.filter(
      (r) => (r.call_logs?.[0]?.outcome ?? r.resolution_type) === "escalated",
    ).length;
    const missed = realCalls.filter((r) => r.call_logs?.[0]?.outcome === "missed").length;
    return { total: realCalls.length, avg, escalated, missed };
  }, [realCalls]);

  return (
    <div className="relative overflow-hidden px-6 py-8 md:px-10">
      <AuroraBackground />
      <div className="relative">
        <SectionLabel index={1}>Calls</SectionLabel>
        <h1 className="mt-2 text-2xl font-bold">Call history</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Test calls are marked so they stay out of your real numbers.
        </p>

        <StatGrid
          className="mt-6"
          stats={[
            { label: "Total calls", value: String(stats.total) },
            { label: "Avg. length", value: duration(stats.avg) },
            { label: "Escalated to human", value: String(stats.escalated) },
            { label: "Missed / voicemail", value: String(stats.missed) },
          ]}
        />

        <div className="panel mt-6 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Length</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No calls yet. Make a test call from the builder to see one here.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const log = row.call_logs?.[0];
                  return (
                    <Fragment key={row.id}>
                      <TableRow>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.started_at ? new Date(row.started_at).toLocaleString() : "—"}
                          {row.is_sandbox ? (
                            <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Test
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.customer_identifier ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {duration(log?.duration_seconds ?? null)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log?.outcome ?? row.resolution_type ?? row.status ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {log?.summary ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpenId(openId === row.id ? null : row.id)}
                          >
                            {openId === row.id ? "Hide" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {openId === row.id ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/40">
                            {log?.summary ? (
                              <p className="mb-3 text-sm font-medium">{log.summary}</p>
                            ) : null}
                            {log?.recording_url ? (
                              <audio
                                controls
                                src={log.recording_url}
                                className="mb-4 w-full max-w-md"
                              />
                            ) : (
                              <p className="mb-3 text-sm text-muted-foreground">
                                No recording available.
                              </p>
                            )}
                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                              {log?.transcript ?? "No transcript available."}
                            </pre>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
