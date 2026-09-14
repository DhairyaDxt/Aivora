import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";
import { CalendlyConnectCard } from "@/components/aivora/CalendlyConnectCard";

export const Route = createFileRoute("/_authenticated/dashboard/connections")({
  head: () => ({
    meta: [
      { title: "Connections — Aivora" },
      { name: "description", content: "See which services power your Aivora receptionist." },
      { property: "og:title", content: "Connections — Aivora" },
      { property: "og:description", content: "See which services power your receptionist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Connections,
});

function Connections() {
  const { data: org } = useOrg();

  const { data: hasTwilio } = useQuery({
    queryKey: ["twilio-connection", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("phone_numbers")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org!.id)
        .eq("provider", "twilio");
      return (count ?? 0) > 0;
    },
  });

  const rows = [
    {
      provider: "Voice engine",
      purpose: "Speech, understanding and call handling",
      status: "Connected",
      action: "Managed by Aivora",
    },
    {
      provider: "Phone numbers",
      purpose: "Buying and running your business number",
      status: hasTwilio ? "Connected" : "Not connected",
      action: hasTwilio ? "Active for this business" : "Connects when you buy a number",
    },
  ];

  return (
    <div className="relative overflow-hidden px-6 py-10 md:px-10 md:py-14">
      <AuroraBackground />
      <div className="relative">
        <SectionLabel index={2}>Connections</SectionLabel>
        <h1 className="mt-2 text-3xl font-bold">Connections</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          The services your receptionist relies on. Nothing to set up by hand.
        </p>

        <div className="panel mt-8 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.provider}>
                  <TableCell className="font-medium">{row.provider}</TableCell>
                  <TableCell className="text-muted-foreground">{row.purpose}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.status === "Connected"
                          ? "rounded-full border border-status-live/30 bg-status-live/12 px-2.5 py-0.5 text-xs font-medium text-status-live"
                          : "rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {org?.id ? (
          <div className="mt-6">
            <CalendlyConnectCard orgId={org.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
