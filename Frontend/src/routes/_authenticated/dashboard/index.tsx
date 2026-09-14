import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, useVoiceService, useWhatsappService, useWebsiteService } from "@/hooks/useOrg";
import { StatusChip } from "@/components/aivora/StatusChip";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { AnimatedNumber } from "@/components/aivora/AnimatedNumber";
import { Reveal } from "@/components/aivora/Reveal";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";
import { ServiceFlowMap } from "@/components/aivora/ServiceFlowMap";
import { TiltCard } from "@/components/landing/TiltCard";
import { Button } from "@/components/ui/button";
import { PhoneCall, MessageCircle, Globe } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Your channels — Aivora" },
      {
        name: "description",
        content: "See the status of your AI voice receptionist and upcoming channels.",
      },
      { property: "og:title", content: "Your channels — Aivora" },
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
  const { data: waService } = useWhatsappService(org?.id);
  const { data: webService } = useWebsiteService(org?.id);

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

  const { data: waMessagesThisWeek = 0 } = useQuery({
    queryKey: ["whatsapp-messages-this-week", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org!.id)
        .eq("channel", "whatsapp")
        .eq("is_sandbox", false)
        .gte("started_at", since);
      return count ?? 0;
    },
  });

  // Extra context for the flow map: what the channels actually share.
  const { data: flowExtras } = useQuery({
    queryKey: ["flow-extras", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const [{ count: kbCount }, { data: calendly }] = await Promise.all([
        supabase
          .from("knowledge_base_entries")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org!.id),
        supabase
          .from("calendly_connections")
          .select("event_type_uri")
          .eq("org_id", org!.id)
          .maybeSingle(),
      ]);
      return {
        knowledgeEntries: kbCount ?? 0,
        calendlyConnected: Boolean(calendly?.event_type_uri),
      };
    },
  });

  const hasAnyService = Boolean(service || waService || webService);

  return (
    <div className="relative overflow-hidden px-6 py-10 md:px-10 md:py-14">
      <AuroraBackground />
      <div className="relative">
        <SectionLabel index={0}>Overview</SectionLabel>
        <h1 className="mt-2 text-3xl font-bold">Your channels</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {hasAnyService
            ? "How your customers reach you, and what every channel shares."
            : "Set up your first channel and this becomes a live map of how it all works."}
        </p>
      </div>

      {hasAnyService ? (
        <Reveal className="relative mt-10">
          <div className="glass p-6 md:p-8">
            <ServiceFlowMap
              voice={
                service
                  ? {
                      id: service.id,
                      status: service.status,
                      conversationsThisWeek: callsThisWeek,
                    }
                  : null
              }
              whatsapp={
                waService
                  ? {
                      id: waService.id,
                      status: waService.status,
                      conversationsThisWeek: waMessagesThisWeek,
                    }
                  : null
              }
              website={webService ? { id: webService.id, status: webService.status } : null}
              knowledgeEntries={flowExtras?.knowledgeEntries ?? 0}
              calendlyConnected={flowExtras?.calendlyConnected ?? false}
            />
          </div>
        </Reveal>
      ) : null}

      <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
        <Reveal>
          <TiltCard intensity={6} className="group h-full">
            <div
              className="glass flex h-full flex-col rounded-2xl p-6"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="flex items-start justify-between">
                <span
                  className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] shadow-[0_8px_20px_-8px_var(--glow)]"
                  style={{ transform: "translateZ(30px)" }}
                >
                  <PhoneCall className="size-5 text-white" />
                </span>
                <StatusChip status={service?.status ?? "draft"} />
              </div>
              <h2 className="mt-5 text-lg font-semibold">Voice receptionist</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Answers your phone, handles questions and takes messages.
              </p>
              <p
                className="mt-6 text-sm text-muted-foreground"
                style={{ transform: "translateZ(16px)" }}
              >
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
          </TiltCard>
        </Reveal>

        <Reveal delayMs={80}>
          <TiltCard intensity={6} className="group h-full">
            <div
              className="glass flex h-full flex-col rounded-2xl p-6"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="flex items-start justify-between">
                <span
                  className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] shadow-[0_8px_20px_-8px_var(--glow)]"
                  style={{ transform: "translateZ(30px)" }}
                >
                  <MessageCircle className="size-5 text-white" />
                </span>
                <StatusChip status={waService?.status ?? "draft"} />
              </div>
              <h2 className="mt-5 text-lg font-semibold">WhatsApp assistant</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Reply to WhatsApp enquiries with the same knowledge base.
              </p>
              <p className="mt-6 text-sm text-muted-foreground">
                Messages this week
                <AnimatedNumber
                  value={String(waMessagesThisWeek)}
                  className="ml-2 text-2xl font-semibold text-foreground"
                />
              </p>
              <div className="mt-6">
                {waService ? (
                  <Button asChild className="w-full">
                    <Link to="/dashboard/whatsapp/$serviceId" params={{ serviceId: waService.id }}>
                      Open builder
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link to="/dashboard/whatsapp/new">Create WhatsApp assistant</Link>
                  </Button>
                )}
              </div>
            </div>
          </TiltCard>
        </Reveal>

        <Reveal delayMs={160}>
          <TiltCard intensity={6} className="group h-full">
            <div
              className="glass flex h-full flex-col rounded-2xl p-6"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="flex items-start justify-between">
                <span
                  className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] shadow-[0_8px_20px_-8px_var(--glow)]"
                  style={{ transform: "translateZ(30px)" }}
                >
                  <Globe className="size-5 text-white" />
                </span>
                <StatusChip status={webService?.status ?? "draft"} />
              </div>
              <h2 className="mt-5 text-lg font-semibold">Website</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A personalized site, published straight to your own Vercel account.
              </p>
              <div className="mt-auto pt-6">
                {webService ? (
                  <Button asChild className="w-full">
                    <Link to="/dashboard/website/$serviceId" params={{ serviceId: webService.id }}>
                      Open builder
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link to="/dashboard/website/new">Create website</Link>
                  </Button>
                )}
              </div>
            </div>
          </TiltCard>
        </Reveal>
      </div>
    </div>
  );
}
