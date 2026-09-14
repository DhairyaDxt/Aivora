import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { BookOpen, Rocket, Sparkles } from "lucide-react";

const STEPS = [
  {
    icon: BookOpen,
    title: "Tell it about your business",
    body: "Paste your hours, prices, services and policies in one go. It reads them and builds a knowledge base automatically — no forms to fill in one field at a time.",
    accent: "01",
  },
  {
    icon: Sparkles,
    title: "Pick your channels",
    body: "Voice, WhatsApp, a website — or all three. They share the same knowledge and the same calendar, so you only set things up once.",
    accent: "02",
  },
  {
    icon: Rocket,
    title: "Go live in minutes",
    body: "Claim a number, connect WhatsApp, publish the site. Test it yourself first, then let it answer for real.",
    accent: "03",
  },
];

function Step({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "center 55%"],
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [0.35, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.97, 1]);

  return (
    <motion.div
      ref={ref}
      {...(reduceMotion ? {} : { style: { opacity, y, scale } })}
      className="relative flex gap-6 md:gap-10"
    >
      {/* Rail with the node for this step */}
      <div className="relative flex flex-col items-center">
        <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] text-white shadow-[0_8px_28px_-10px_var(--glow)]">
          <step.icon className="size-5" />
        </span>
        {index < STEPS.length - 1 ? (
          <span className="w-px flex-1 bg-gradient-to-b from-[var(--grad-to)]/50 to-transparent" />
        ) : null}
      </div>

      <div className="pb-16">
        <span className="font-display text-sm font-bold tracking-widest text-[var(--grad-to)]/70">
          {step.accent}
        </span>
        <h3 className="mt-2 text-xl font-bold md:text-2xl">{step.title}</h3>
        <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">{step.body}</p>
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <div className="mt-14">
      {STEPS.map((step, index) => (
        <Step key={step.title} step={step} index={index} />
      ))}
    </div>
  );
}
