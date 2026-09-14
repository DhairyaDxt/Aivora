import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Globe, MessageCircle, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

type Line = { from: "customer" | "ai"; text: string };

type Channel = {
  id: string;
  label: string;
  icon: typeof PhoneCall;
  headline: string;
  body: string;
  transcript: Line[];
};

const CHANNELS: Channel[] = [
  {
    id: "voice",
    label: "Voice",
    icon: PhoneCall,
    headline: "It picks up on the first ring.",
    body: "Answers questions in your own words, books the job, and puts the urgent ones straight through to you.",
    transcript: [
      { from: "customer", text: "Hi, do you have anything free on Friday?" },
      { from: "ai", text: "We do — I've got 10:30 or 2 o'clock on Friday. Which suits better?" },
      { from: "customer", text: "Two o'clock, please." },
      { from: "ai", text: "Booked for Friday at 2. I'll send the confirmation by email now." },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    headline: "It replies while you're on the tools.",
    body: "Answers from the same knowledge base, books into the same calendar, and hands the thread to you the moment someone asks for a human.",
    transcript: [
      { from: "customer", text: "how much for a full service?" },
      {
        from: "ai",
        text: "A full service is £120, and takes about two hours. Want me to find you a slot?",
      },
      { from: "customer", text: "yes please, sometime next week" },
      { from: "ai", text: "Tuesday 9am or Thursday 1pm are both free — which works?" },
    ],
  },
  {
    id: "website",
    label: "Website",
    icon: Globe,
    headline: "A site that books, not just sits there.",
    body: "Pick a template, we write the copy from what your assistant already knows, and publish straight to your own Vercel account.",
    transcript: [
      { from: "customer", text: "→ visitor lands on your homepage" },
      { from: "ai", text: "Sees your services, prices and real opening hours" },
      { from: "customer", text: "→ taps “Book now”" },
      { from: "ai", text: "Straight into the same calendar every other channel uses" },
    ],
  },
];

export function ChannelShowcase() {
  const [activeId, setActiveId] = useState(CHANNELS[0]!.id);
  const [visibleLines, setVisibleLines] = useState(0);
  const reduceMotion = useReducedMotion();
  const active = CHANNELS.find((c) => c.id === activeId) ?? CHANNELS[0]!;

  // Type the conversation out line by line so the panel feels like a live
  // call rather than a screenshot.
  useEffect(() => {
    if (reduceMotion) {
      setVisibleLines(active.transcript.length);
      return;
    }
    setVisibleLines(0);
    const timers = active.transcript.map((_, index) =>
      setTimeout(() => setVisibleLines(index + 1), 550 + index * 900),
    );
    return () => timers.forEach(clearTimeout);
  }, [activeId, active.transcript, reduceMotion]);

  // Cycle channels on their own so the section demos itself if nobody clicks.
  useEffect(() => {
    if (reduceMotion) return;
    const total = 900 * active.transcript.length + 2600;
    const timer = setTimeout(() => {
      const index = CHANNELS.findIndex((c) => c.id === activeId);
      setActiveId(CHANNELS[(index + 1) % CHANNELS.length]!.id);
    }, total);
    return () => clearTimeout(timer);
  }, [activeId, active.transcript.length, reduceMotion]);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((channel) => {
            const isActive = channel.id === activeId;
            return (
              <button
                key={channel.id}
                onClick={() => setActiveId(channel.id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive ? "text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="channel-pill"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-[var(--grad-from)] to-[var(--grad-to)] shadow-[0_6px_24px_-8px_var(--glow)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <channel.icon className="relative size-4" />
                <span className="relative">{channel.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            {...(reduceMotion ? {} : { exit: { opacity: 0, y: -8 } })}
            transition={{ duration: 0.35 }}
            className="mt-8"
          >
            <h3 className="text-2xl font-bold md:text-3xl">{active.headline}</h3>
            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{active.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Device frame */}
      <div className="relative">
        <div
          className="glass relative overflow-hidden rounded-3xl p-5 shadow-[0_24px_80px_-32px_var(--glow)]"
          style={{ perspective: 1000 }}
        >
          <div className="flex items-center gap-2 border-b border-white/[0.06] pb-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] text-white">
              <active.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{active.label}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-status-live" />
                live now
              </p>
            </div>
          </div>

          <div className="mt-4 flex min-h-[260px] flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {active.transcript.slice(0, visibleLines).map((line, index) => (
                <motion.div
                  key={`${active.id}-${index}`}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    line.from === "customer"
                      ? "self-start rounded-bl-md bg-white/[0.06] text-foreground/90"
                      : "self-end rounded-br-md bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] text-white shadow-[0_8px_24px_-12px_var(--glow)]",
                  )}
                >
                  {line.text}
                </motion.div>
              ))}
            </AnimatePresence>

            {!reduceMotion && visibleLines < active.transcript.length ? (
              <div className="flex gap-1 self-end rounded-2xl bg-white/[0.06] px-3 py-3">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="size-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.18 }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Floating depth accents */}
        <div className="absolute -top-6 -right-6 -z-10 size-40 rounded-full bg-[var(--grad-to)]/25 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 -z-10 size-48 rounded-full bg-[var(--grad-from)]/20 blur-3xl" />
      </div>
    </div>
  );
}
