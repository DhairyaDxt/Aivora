import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  ArrowDown,
  PhoneIncoming,
  ShieldCheck,
  MessageSquare,
  CalendarClock,
  PhoneForwarded,
  Voicemail,
  BookOpen,
} from "lucide-react";

export type FlowConfig = {
  consent_enabled: boolean;
  kb_enabled: boolean;
  functions_enabled: Record<string, boolean>;
  after_hours_behavior: string;
};

type Step = {
  key: string;
  title: string;
  body: string;
  icon: typeof PhoneIncoming;
  toggleable: boolean;
  enabled: boolean;
  onToggle?: (value: boolean) => void;
};

export function FlowDiagram({
  config,
  onChange,
}: {
  config: FlowConfig;
  onChange: (patch: Partial<FlowConfig>) => void;
}) {
  const fns = config.functions_enabled ?? {};
  const setFn = (key: string, value: boolean) =>
    onChange({ functions_enabled: { ...fns, [key]: value } });

  const steps: Step[] = [
    {
      key: "answer",
      title: "Call comes in",
      body: "Your receptionist picks up and greets the caller.",
      icon: PhoneIncoming,
      toggleable: false,
      enabled: true,
    },
    {
      key: "consent",
      title: "Recording notice",
      body: "Tells the caller they're speaking with an assistant and may be recorded.",
      icon: ShieldCheck,
      toggleable: true,
      enabled: config.consent_enabled,
      onToggle: (value) => onChange({ consent_enabled: value }),
    },
    {
      key: "kb",
      title: "Answer questions",
      body: "Uses your knowledge base to answer what the caller asks.",
      icon: BookOpen,
      toggleable: true,
      enabled: config.kb_enabled,
      onToggle: (value) => onChange({ kb_enabled: value }),
    },
    {
      key: "check_availability",
      title: "Check availability",
      body: "Looks up open times before offering a slot.",
      icon: CalendarClock,
      toggleable: true,
      enabled: fns["check_availability"] !== false,
      onToggle: (value) => setFn("check_availability", value),
    },
    {
      key: "book_appointment",
      title: "Book the appointment",
      body: "Confirms the details and books the caller in.",
      icon: CalendarClock,
      toggleable: true,
      enabled: fns["book_appointment"] !== false,
      onToggle: (value) => setFn("book_appointment", value),
    },
    {
      key: "take_message",
      title: "Take a message",
      body: "Captures name, number and reason when you're needed.",
      icon: MessageSquare,
      toggleable: true,
      enabled: fns["take_message"] !== false,
      onToggle: (value) => setFn("take_message", value),
    },
    {
      key: "transfer_call",
      title: "Transfer to a person",
      body: "Puts urgent callers through to your escalation number.",
      icon: PhoneForwarded,
      toggleable: true,
      enabled: fns["transfer_call"] !== false,
      onToggle: (value) => setFn("transfer_call", value),
    },
    {
      key: "after_hours",
      title: "Outside opening hours",
      body:
        config.after_hours_behavior === "transfer"
          ? "Transfers the caller to your escalation number."
          : config.after_hours_behavior === "message_only"
            ? "Takes a message only."
            : "Explains you're closed and takes a message.",
      icon: Voicemail,
      toggleable: false,
      enabled: true,
    },
  ];

  return (
    <div className="mx-auto max-w-lg">
      {steps.map((step, index) => (
        <div key={step.key}>
          <div
            className={cn(
              "panel flex items-start gap-4 p-4 transition-opacity",
              !step.enabled && "opacity-45",
            )}
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-voice-soft text-accent-foreground">
              <step.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
            {step.toggleable ? (
              <Switch checked={step.enabled} onCheckedChange={step.onToggle ?? (() => {})} />
            ) : null}
          </div>
          {index < steps.length - 1 ? (
            <div className="flex justify-center py-1.5 text-muted-foreground">
              <ArrowDown className="size-4" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
