import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Do callers know they're speaking to an AI?",
    a: "Yes — it says so at the start of every call, and you control the exact wording. That's both the honest thing to do and, increasingly, the legally required one.",
  },
  {
    q: "What happens if it doesn't know the answer?",
    a: "It says so rather than guessing, then takes a message or transfers to you. It only answers from the knowledge base you gave it, so it can't invent prices or promise things you don't offer.",
  },
  {
    q: "Can I use my existing phone number?",
    a: "You can claim a new number in seconds, or bring your own and forward it. Either way the number stays yours.",
  },
  {
    q: "Does it actually book into my calendar?",
    a: "Connect Calendly once and every channel — phone, WhatsApp and your website — checks real availability and writes real bookings. It re-checks the slot before confirming, so you don't get double-booked.",
  },
  {
    q: "What languages does it speak?",
    a: "Turn on auto-detect and it replies in whatever language the caller uses — English, Spanish, French, German, Hindi, Russian, Portuguese, Japanese, Italian or Dutch.",
  },
  {
    q: "How long does setup take?",
    a: "Most businesses are live in under ten minutes: paste your business details, pick a voice, claim a number, test it, go live.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/[0.06]">
      {FAQS.map((faq, index) => {
        const isOpen = open === index;
        return (
          <div key={faq.q}>
            <button
              onClick={() => setOpen(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-6 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span
                className={cn("font-medium transition-colors", isOpen && "text-[var(--grad-to)]")}
              >
                {faq.q}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 24 }}
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted-foreground"
              >
                <Plus className="size-3.5" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 leading-relaxed text-muted-foreground">{faq.a}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
