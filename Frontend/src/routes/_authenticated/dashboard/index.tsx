import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, useVoiceService } from "@/hooks/useOrg";
import { StatusChip } from "@/components/bizpilot/StatusChip";
import { SectionLabel } from "@/components/bizpilot/SectionLabel";
import { AnimatedNumber } from "@/components/bizpilot/AnimatedNumber";
import { Reveal } from "@/components/bizpilot/Reveal";
import { AuroraBackground } from "@/components/bizpilot/AuroraBackground";
import { Button } from "@/components/ui/button";
import { PhoneCall, MessageCircle, Globe } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Your channels — BizPilot" },
      {
        name: "description",
        content: "See the status of your AI voice receptionist and upcoming channels.",
      },
      { property: "og:title", content: "Your channels — BizPilot" },
      { property: "og:description", content: "Manage your AI voice receptionist from one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardHome,
});

function DashboardHome() {
  const { data: org } = useOrg();
  const { data: service } = useVoiceService(org?.id);

  const { data: callsThisWeek = 0 } = useQuery({
    queryKey: ["calls-this-week", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org!.id)
        .eq("is_sandbox", false)
        .gte("started_at", since);
      return count ?? 0;
    },
  });

  return (
    <div className="relative overflow-hidden px-6 py-10 md:px-10 md:py-14">
      <AuroraBackground />
      <div className="relative">
        <SectionLabel index={0}>Overview</SectionLabel>
        <h1 className="mt-2 text-3xl font-bold">Your channels</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Voice is live today. More ways to answer your customers are on the way.
        </p>
      </div>

      <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
        <Reveal>
          <div className="glass hover-lift flex h-full flex-col p-6">
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] shadow-[0_4px_16px_-4px_var(--glow)]">
                <PhoneCall className="size-5 text-white" />
              </span>
              <StatusChip status={service?.status ?? "draft"} />
            </div>
            <h2 className="mt-5 text-lg font-semibold">Voice receptionist</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Answers your phone, handles questions and takes messages.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              Calls this week
              <AnimatedNumber
                value={String(callsThisWeek)}
                className="ml-2 text-2xl font-semibold text-foreground"
              />
            </p>
            <div className="mt-6">
              {service ? (
                <Button asChild className="w-full">
                  <Link to="/dashboard/voice/$serviceId" params={{ serviceId: service.id }}>
                    Open builder
                  </Link>
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link to="/dashboard/voice/new">Create receptionist</Link>
                </Button>
              )}
            </div>
          </div>
        </Reveal>

        {[
          {
            icon: MessageCircle,
            title: "WhatsApp assistant",
            body: "Reply to WhatsApp enquiries with the same knowledge base.",
          },
          {
            icon: Globe,
            title: "Website builder",
            body: "A simple site and chat widget that matches your receptionist.",
          },
        ].map((item, index) => (
          <Reveal key={item.title} delayMs={(index + 1) * 80}>
            <div className="glass hover-lift flex h-full flex-col p-6 opacity-60">
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <item.icon className="size-5" />
                </span>
                <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Coming soon
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              <div className="mt-auto pt-6">
                <Button className="w-full" variant="outline" disabled>
                  Not available yet
                </Button>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
