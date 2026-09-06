import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/bizpilot/Reveal";
import { Marquee } from "@/components/bizpilot/Marquee";
import { SectionLabel } from "@/components/bizpilot/SectionLabel";
import { StatGrid } from "@/components/bizpilot/StatGrid";
import { StatusDot } from "@/components/bizpilot/StatusDot";
import {
  PhoneCall,
  CalendarCheck,
  MessageSquareText,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BizPilot — an AI receptionist that answers every call" },
      {
        name: "description",
        content:
          "BizPilot gives small businesses an AI voice receptionist that answers calls, books work and takes messages. Set it up in minutes, no code needed.",
      },
      { property: "og:title", content: "BizPilot — an AI receptionist that answers every call" },
      {
        property: "og:description",
        content: "Answer every call with an AI receptionist you can set up in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: PhoneCall,
    title: "Answers on the first ring",
    body: "Your receptionist picks up every call, day or night, in your own words.",
  },
  {
    icon: CalendarCheck,
    title: "Handles the routine",
    body: "Opening hours, pricing questions, directions and callbacks — handled without you.",
  },
  {
    icon: MessageSquareText,
    title: "Takes proper messages",
    body: "Every call is transcribed and recorded, so nothing gets lost between jobs.",
  },
  {
    icon: ShieldCheck,
    title: "Transfers when it matters",
    body: "Urgent callers get passed straight through to you or your team.",
  },
];

const stats = [
  { label: "Setup time", value: "< 10 min", sub: "From signup to live" },
  { label: "Answer rate", value: "100%", sub: "Every call, every time" },
  { label: "Channels live", value: "1", sub: "Voice, today" },
  { label: "Channels planned", value: "2", sub: "WhatsApp, Web" },
];

const capabilities = [
  "VOICE RECEPTIONIST",
  "CALL TRANSCRIPTS",
  "KNOWLEDGE BASE",
  "APPOINTMENT ROUTING",
  "LIVE TRANSFER",
  "USAGE ANALYTICS",
  "CUSTOM GREETING",
  "MULTI-LANGUAGE",
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground opacity-50" />
        <span className="relative inline-flex size-2 rounded-full bg-foreground" />
      </span>
      <span className="font-semibold">biz.pilot</span>
      <span className="text-muted-foreground">/ voice-ai</span>
    </Link>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-sm">
          <Logo />
          <div className="flex items-center gap-1">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 md:pt-24">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 text-xs">
            <StatusDot>ANSWERING CALLS · LIVE</StatusDot>
            <span className="label-tag">V.1.0 — VOICE CHANNEL</span>
          </div>

          <Reveal>
            <h1 className="max-w-3xl text-4xl leading-[1.1] font-semibold md:text-6xl">
              An AI receptionist
              <br />
              that answers <span className="text-muted-foreground">every call.</span>
              <span className="cursor-blink" />
            </h1>
          </Reveal>

          <Reveal delayMs={120}>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Give BizPilot your hours, services and tone of voice. It picks up the phone, answers
              questions, takes messages and transfers the calls that need you.
            </p>
          </Reveal>

          <Reveal delayMs={220}>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Set up my receptionist <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delayMs={320} className="mt-16">
            <StatGrid stats={stats} />
          </Reveal>
        </section>

        <Marquee items={capabilities} />

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionLabel index={1}>What it does</SectionLabel>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold md:text-4xl">
                One receptionist, every job your front desk used to do.
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-px overflow-hidden border border-border sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <Reveal key={feature.title} delayMs={index * 80}>
                  <div className="group h-full border-border bg-background p-6 transition-colors hover:bg-secondary/40 sm:border-r sm:last:border-r-0">
                    <feature.icon className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                    <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal className="panel flex flex-col items-start justify-between gap-6 p-10 sm:flex-row sm:items-center">
              <div>
                <SectionLabel index={2}>Get started</SectionLabel>
                <h2 className="mt-3 text-2xl font-semibold md:text-3xl">
                  Set up your receptionist today.
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  No code, no call centre — just your business info and a phone number.
                </p>
              </div>
              <Button size="lg" asChild>
                <Link to="/signup">
                  Get started free <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>BizPilot — one channel at a time, starting with voice.</span>
          <span className="label-tag">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
