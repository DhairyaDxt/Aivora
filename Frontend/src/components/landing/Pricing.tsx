import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TiltCard } from "./TiltCard";

type Plan = {
  id: string;
  name: string;
  blurb: string;
  monthly: number;
  yearly: number;
  features: string[];
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "One channel, up and running today.",
    monthly: 29,
    yearly: 24,
    features: [
      "One channel of your choice",
      "AI knowledge base",
      "Call & chat transcripts",
      "Calendly booking",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "Every channel, sharing one brain.",
    monthly: 79,
    yearly: 65,
    featured: true,
    features: [
      "Voice, WhatsApp and website",
      "Everything in Starter",
      "Human handover inbox",
      "AI website builder",
      "Multi-language calls",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    blurb: "For teams handling real volume.",
    monthly: 199,
    yearly: 165,
    features: [
      "Everything in Growth",
      "Multiple numbers & locations",
      "Team roles and permissions",
      "Usage analytics & exports",
      "Dedicated onboarding",
    ],
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <div>
      <div className="flex justify-center">
        <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
          {[
            { id: "monthly", label: "Monthly" },
            { id: "yearly", label: "Yearly" },
          ].map((option) => {
            const isActive = (option.id === "yearly") === yearly;
            return (
              <button
                key={option.id}
                onClick={() => setYearly(option.id === "yearly")}
                className={cn(
                  "relative rounded-full px-4 py-1.5 font-medium transition-colors",
                  isActive ? "text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="billing-pill"
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
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Yearly billing saves around two months. Cancel whenever you like.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan, index) => (
          <TiltCard key={plan.id} intensity={6} className="group h-full">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className={cn(
                "relative flex h-full flex-col overflow-hidden rounded-2xl border p-7",
                plan.featured
                  ? "border-[var(--grad-to)]/40 bg-gradient-to-b from-[var(--grad-from)]/[0.12] to-transparent shadow-[0_20px_60px_-30px_var(--glow)]"
                  : "border-white/10 bg-white/[0.02]",
              )}
            >
              {plan.featured ? (
                <span className="absolute top-5 right-5 rounded-full bg-gradient-to-r from-[var(--grad-from)] to-[var(--grad-to)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                  Most popular
                </span>
              ) : null}

              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tabular-nums">
                  ${yearly ? plan.yearly : plan.monthly}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-[var(--grad-to)]" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={plan.featured ? "default" : "outline"}
                className="mt-7 w-full"
              >
                <Link to="/signup">Start free</Link>
              </Button>
            </motion.div>
          </TiltCard>
        ))}
      </div>
    </div>
  );
}
