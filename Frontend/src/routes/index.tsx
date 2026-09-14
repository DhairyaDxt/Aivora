import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/aivora/Reveal";
import { Marquee } from "@/components/aivora/Marquee";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { StatusDot } from "@/components/aivora/StatusDot";
import { Waveform } from "@/components/aivora/Waveform";
import { TypingLine } from "@/components/aivora/TypingLine";
import { ScrollProgress } from "@/components/aivora/ScrollProgress";
import { AivoraLogo } from "@/components/brand/AivoraLogo";
import { AnimatedNumber } from "@/components/aivora/AnimatedNumber";
import { HeroCanvas } from "@/components/landing/HeroCanvas";
import { TiltCard, Magnetic } from "@/components/landing/TiltCard";
import { ChannelShowcase } from "@/components/landing/ChannelShowcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { Faq } from "@/components/landing/Faq";
import {
  PhoneCall,
  CalendarCheck,
  MessageSquareText,
  ShieldCheck,
  ArrowUpRight,
  BookOpen,
  Languages,
  Globe,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aivora — the AI front desk for small business" },
      {
        name: "description",
        content:
          "Aivora answers your phone, replies on WhatsApp and builds your website — all from one knowledge base, booking into one calendar. Live in under ten minutes.",
      },
      { property: "og:title", content: "Aivora — the AI front desk for small business" },
      {
        property: "og:description",
        content:
          "One AI front desk across phone, WhatsApp and web. Answers questions, books work, never misses a customer.",
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
    body: "Every call picked up, day or night, in your own words and your own tone.",
  },
  {
    icon: BookOpen,
    title: "Knows your business",
    body: "Paste your prices, hours and policies once. Every channel answers from the same source.",
  },
  {
    icon: CalendarCheck,
    title: "Books real appointments",
    body: "Checks live availability, re-checks before confirming, writes straight to your calendar.",
  },
  {
    icon: MessageSquareText,
    title: "Never loses a message",
    body: "Every call and chat transcribed, summarised and searchable in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Hands over to you",
    body: "Urgent callers get transferred. Tricky chats land in your inbox for a human reply.",
  },
  {
    icon: Languages,
    title: "Speaks their language",
    body: "Detects the caller's language mid-sentence and answers in it — ten languages supported.",
  },
  {
    icon: Globe,
    title: "Builds your website",
    body: "Pick a template, AI writes the copy from what it already knows, publish to your own Vercel.",
  },
  {
    icon: Inbox,
    title: "One shared inbox",
    body: "Phone, WhatsApp and web conversations all land together, whichever way they came in.",
  },
];

const capabilities = [
  "VOICE RECEPTIONIST",
  "WHATSAPP ASSISTANT",
  "AI WEBSITE BUILDER",
  "KNOWLEDGE BASE",
  "LIVE BOOKING",
  "CALL TRANSCRIPTS",
  "HUMAN HANDOVER",
  "MULTI-LANGUAGE",
  "USAGE ANALYTICS",
];

const stats = [
  { value: "10", suffix: " min", label: "From signup to answering calls" },
  { value: "100", suffix: "%", label: "Of calls picked up, day or night" },
  { value: "3", suffix: "", label: "Channels, one shared brain" },
  { value: "10", suffix: "", label: "Languages understood and spoken" },
];

function Logo() {
  return <AivoraLogo />;
}

/** Header that goes from transparent over the hero to solid once you scroll,
 * so the 3D scene isn't cut off by a bar at the top of the page. */
function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/[0.06] bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-sm">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#channels" className="transition-colors hover:text-foreground">
            Channels
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
        </nav>
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
  );
}

function Landing() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <Header />

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="relative isolate overflow-hidden">
          <HeroCanvas />

          <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-28 md:pt-28 md:pb-36">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 flex flex-wrap items-center gap-3 text-xs"
            >
              <StatusDot>ANSWERING CALLS · LIVE</StatusDot>
              <span className="label-tag">VOICE · WHATSAPP · WEB</span>
            </motion.div>

            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="max-w-4xl text-4xl leading-[1.05] font-bold tracking-tight md:text-7xl"
            >
              Never miss a customer
              <br />
              <span className="text-gradient">again.</span>
            </motion.h1>

            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            >
              Aivora answers your phone, replies on WhatsApp and builds your website — all from one
              knowledge base, booking into one calendar.
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-7 flex items-center gap-3 text-sm text-muted-foreground"
            >
              <Waveform />
              <TypingLine
                prefix="Ask it "
                words={[
                  '"what are your hours?"',
                  '"can I book Friday?"',
                  '"how much is a service?"',
                  '"¿hablan español?"',
                ]}
              />
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Magnetic>
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Set up my front desk <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </Magnetic>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">I already have an account</Link>
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] lg:grid-cols-4"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="bg-background/40 p-6 backdrop-blur-sm">
                  <p className="flex items-baseline font-display text-3xl font-bold">
                    <AnimatedNumber value={stat.value} />
                    <span className="text-[var(--grad-to)]">{stat.suffix}</span>
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <Marquee items={capabilities} />

        {/* ------------------------------------------------------ channels */}
        <section id="channels" className="scroll-mt-24 border-b border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <SectionLabel index={1}>Every channel</SectionLabel>
              <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">
                One front desk.
                <br />
                <span className="text-muted-foreground">However they reach you.</span>
              </h2>
            </Reveal>

            <div className="mt-16">
              <ChannelShowcase />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ features */}
        <section className="border-b border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <SectionLabel index={2}>What it does</SectionLabel>
              <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">
                Everything your front desk used to do.
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <Reveal key={feature.title} delayMs={index * 60}>
                  <TiltCard className="group h-full" intensity={7}>
                    <div className="glass h-full overflow-hidden rounded-2xl p-6">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--grad-from)]/25 to-[var(--grad-to)]/25 text-[var(--grad-to)] transition-colors group-hover:from-[var(--grad-from)] group-hover:to-[var(--grad-to)] group-hover:text-white">
                        <feature.icon className="size-5" />
                      </span>
                      <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {feature.body}
                      </p>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- how it works */}
        <section id="how" className="scroll-mt-24 border-b border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <SectionLabel index={3}>How it works</SectionLabel>
              <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">
                Live before your next coffee.
              </h2>
            </Reveal>
            <HowItWorks />
          </div>
        </section>

        {/* ------------------------------------------------------- pricing */}
        <section
          id="pricing"
          className="relative scroll-mt-24 overflow-hidden border-b border-white/[0.06]"
        >
          <div className="absolute top-0 left-1/2 -z-10 size-[40rem] -translate-x-1/2 rounded-full bg-[var(--grad-from)]/10 blur-[140px]" />
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal className="text-center">
              <SectionLabel index={4}>Pricing</SectionLabel>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
                Costs less than missing one job.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Start free while you set it up. Only pay once it's answering real customers.
              </p>
            </Reveal>
            <div className="mt-12">
              <Pricing />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- faq */}
        <section id="faq" className="scroll-mt-24 border-b border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal className="text-center">
              <SectionLabel index={5}>Questions</SectionLabel>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
                The things people ask first.
              </h2>
            </Reveal>
            <div className="mt-14">
              <Faq />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- final cta */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_50%_100%,color-mix(in_srgb,var(--grad-to)_18%,transparent),transparent_70%)]" />
          <div className="mx-auto max-w-4xl px-6 py-28 text-center">
            <Reveal>
              <h2 className="text-3xl font-bold tracking-tight md:text-6xl">
                Your phone is ringing
                <br />
                <span className="text-gradient">right now.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
                Set Aivora up once and stop losing the customers you never knew called.
              </p>
              <div className="mt-10 flex justify-center">
                <Magnetic strength={0.3}>
                  <Button size="lg" asChild>
                    <Link to="/signup">
                      Get started free <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </Magnetic>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                No card required · Live in under 10 minutes
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The AI front desk for small business — phone, WhatsApp and web, sharing one brain.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
              <div>
                <p className="font-semibold">Product</p>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>
                    <a href="#channels" className="transition-colors hover:text-foreground">
                      Channels
                    </a>
                  </li>
                  <li>
                    <a href="#how" className="transition-colors hover:text-foreground">
                      How it works
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="transition-colors hover:text-foreground">
                      Pricing
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">Company</p>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>
                    <a href="#faq" className="transition-colors hover:text-foreground">
                      FAQ
                    </a>
                  </li>
                  <li>
                    <Link to="/login" className="transition-colors hover:text-foreground">
                      Sign in
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">Get started</p>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>
                    <Link to="/signup" className="transition-colors hover:text-foreground">
                      Create an account
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-sm text-muted-foreground sm:flex-row">
            <span>Aivora — one front desk, every channel.</span>
            <span className="label-tag">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
