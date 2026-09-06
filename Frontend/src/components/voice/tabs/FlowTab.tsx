import { ReactNode } from "react";
import { VoiceConfig } from "../VoiceBuilder";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PhoneIncoming,
  ShieldCheck,
  FileAudio,
  Brain,
  HelpCircle,
  Calendar,
  PhoneForwarded,
  Volume2,
  Pencil,
  Globe,
  VoicemailIcon,
  Sparkles,
} from "lucide-react";

interface FlowTabProps {
  config: Partial<VoiceConfig>;
  onChange: (updates: Partial<VoiceConfig>) => void;
}

function StatusBadge({
  on,
  onLabel = "On",
  offLabel = "Off",
}: {
  on: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={
        on
          ? "border-status-live/40 bg-status-live/10 text-status-live"
          : "border-status-draft/40 bg-status-draft/10 text-status-draft"
      }
    >
      {on ? onLabel : offLabel}
    </Badge>
  );
}

function StageCard({
  icon,
  title,
  summary,
  badge,
  editable,
  children,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  badge?: ReactNode;
  editable?: boolean;
  children?: ReactNode;
}) {
  const card = (
    <div
      className={`group flex items-start gap-4 rounded-xl border bg-card p-4 transition-colors ${
        editable ? "cursor-pointer hover:border-voice/50 hover:bg-voice-soft/40" : ""
      }`}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-voice-soft text-voice">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{title}</h3>
          {badge}
          {editable ? (
            <Pencil className="ml-auto size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{summary}</p>
      </div>
    </div>
  );

  if (!editable || !children) return card;

  return (
    <Popover>
      <PopoverTrigger asChild>{card}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Connector() {
  return <div className="ml-9 h-5 w-px bg-border" />;
}

export function FlowTab({ config, onChange }: FlowTabProps) {
  const modelName = config.llm_provider === "anthropic" ? "Claude 3 Haiku" : "GPT-4o Mini";
  const functions = (config.functions_enabled as Record<string, boolean>) || {};
  const transferOn = functions["transfer_call"] !== false;
  const destinationCount = Array.isArray(config.transfer_destinations)
    ? config.transfer_destinations.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Call flow</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Click any step to edit it inline. This mirrors the other tabs, so changes here show up
          there too.
        </p>
      </div>

      <div className="space-y-0 rounded-xl border bg-muted/20 p-6">
        <StageCard
          icon={<PhoneIncoming className="size-5" />}
          title="Incoming call"
          summary={
            config.vapi_phone_number_id
              ? "Phone number connected"
              : "No phone number assigned yet — see the Phone tab"
          }
        />
        <Connector />

        <StageCard
          icon={<ShieldCheck className="size-5" />}
          title="AI disclosure"
          summary={config.consent_message || "Default consent message"}
          badge={<StatusBadge on={config.consent_enabled !== false} />}
          editable
        >
          <div className="flex items-center justify-between">
            <Label className="text-sm">Play consent message</Label>
            <Switch
              checked={config.consent_enabled !== false}
              onCheckedChange={(checked) => onChange({ consent_enabled: checked })}
            />
          </div>
          {config.consent_enabled !== false ? (
            <Textarea
              className="text-sm"
              value={config.consent_message ?? ""}
              onChange={(e) => onChange({ consent_message: e.target.value })}
              placeholder="This call may be recorded and you are speaking with an AI assistant."
            />
          ) : null}
        </StageCard>
        <Connector />

        <StageCard
          icon={<FileAudio className="size-5" />}
          title="Greeting"
          summary={config.greeting_script || "Hello! How can I help you today?"}
          editable
        >
          <Label className="text-sm">Greeting script</Label>
          <Textarea
            className="text-sm"
            value={config.greeting_script ?? ""}
            onChange={(e) => onChange({ greeting_script: e.target.value })}
            placeholder="Thanks for calling. How can I help?"
          />
        </StageCard>
        <Connector />

        <StageCard
          icon={<Brain className="size-5" />}
          title="Understand intent"
          summary={`${modelName} · temperature ${config.temperature ?? 0.5}`}
          badge={
            config.multilingual_enabled ? (
              <Badge variant="outline" className="border-voice/40 bg-voice-soft text-voice">
                <Globe className="mr-1 size-3" /> Multilingual
              </Badge>
            ) : undefined
          }
          editable
        >
          <Label className="text-sm">AI model</Label>
          <Select
            value={config.llm_provider || "openai"}
            onValueChange={(val) => onChange({ llm_provider: val })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (GPT-4o Mini)</SelectItem>
              <SelectItem value="anthropic">Anthropic (Claude 3 Haiku)</SelectItem>
              <SelectItem value="custom">Custom LLM</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between pt-1">
            <Label className="text-sm">Auto-detect caller language</Label>
            <Switch
              checked={config.multilingual_enabled === true}
              onCheckedChange={(checked) => onChange({ multilingual_enabled: checked })}
            />
          </div>
        </StageCard>

        <Connector />

        <div className="grid gap-4 sm:grid-cols-3">
          <StageCard
            icon={<HelpCircle className="size-5" />}
            title="Knowledge base"
            summary={config.kb_enabled ? "Answers from your knowledge base" : "Disabled"}
            badge={<StatusBadge on={config.kb_enabled === true} />}
            editable
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm">Use knowledge base</Label>
              <Switch
                checked={config.kb_enabled === true}
                onCheckedChange={(checked) => onChange({ kb_enabled: checked })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Manage entries on the Knowledge tab or Knowledge base page.
            </p>
          </StageCard>

          <StageCard
            icon={<Calendar className="size-5" />}
            title="Booking"
            summary={functions["book_appointment"] !== false ? "Can book appointments" : "Disabled"}
            badge={<StatusBadge on={functions["book_appointment"] !== false} />}
            editable
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm">Check availability</Label>
              <Switch
                checked={functions["check_availability"] !== false}
                onCheckedChange={(checked) =>
                  onChange({ functions_enabled: { ...functions, check_availability: checked } })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Book appointment</Label>
              <Switch
                checked={functions["book_appointment"] !== false}
                onCheckedChange={(checked) =>
                  onChange({ functions_enabled: { ...functions, book_appointment: checked } })
                }
              />
            </div>
          </StageCard>

          <StageCard
            icon={<PhoneForwarded className="size-5" />}
            title="Human transfer"
            summary={
              !transferOn
                ? "Disabled"
                : destinationCount > 0
                  ? `${destinationCount} named line${destinationCount > 1 ? "s" : ""}`
                  : config.escalation_number
                    ? `To ${config.escalation_number}`
                    : "No number set"
            }
            badge={<StatusBadge on={transferOn} />}
            editable
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm">Allow transfer</Label>
              <Switch
                checked={transferOn}
                onCheckedChange={(checked) =>
                  onChange({ functions_enabled: { ...functions, transfer_call: checked } })
                }
              />
            </div>
            {transferOn && destinationCount === 0 ? (
              <>
                <Label className="text-sm">Escalation number</Label>
                <Input
                  className="text-sm"
                  value={config.escalation_number ?? ""}
                  onChange={(e) => onChange({ escalation_number: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </>
            ) : null}
            <p className="text-xs text-muted-foreground">Manage named lines on the Actions tab.</p>
          </StageCard>
        </div>

        <Connector />

        <StageCard
          icon={<Volume2 className="size-5" />}
          title="Speak response"
          summary={`${config.voice_provider ?? "11labs"} · ${config.voice_id || "default voice"}`}
          badge={
            <div className="flex gap-1">
              {config.voicemail_detection_enabled ? (
                <Badge variant="outline" className="border-voice/40 bg-voice-soft text-voice">
                  <VoicemailIcon className="mr-1 size-3" /> Voicemail
                </Badge>
              ) : null}
              {config.call_summary_enabled !== false ? (
                <Badge variant="outline" className="border-voice/40 bg-voice-soft text-voice">
                  <Sparkles className="mr-1 size-3" /> Summaries
                </Badge>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="rounded-lg border p-4 bg-muted/30">
        <h4 className="mb-3 text-sm font-medium">Current configuration</h4>
        <div className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <span className="text-muted-foreground">Model:</span>{" "}
            <span className="ml-1 font-medium">{modelName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Voice:</span>{" "}
            <span className="ml-1 font-medium">
              {config.voice_provider ?? "11labs"} / {config.voice_id || "default"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Temperature:</span>{" "}
            <span className="ml-1 font-medium">{config.temperature ?? 0.5}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Consent:</span>{" "}
            <span className="ml-1 font-medium">
              {config.consent_enabled === false ? "Disabled" : "Enabled"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Knowledge base:</span>{" "}
            <span className="ml-1 font-medium">{config.kb_enabled ? "Yes" : "No"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Escalation:</span>{" "}
            <span className="ml-1 font-medium">
              {destinationCount > 0
                ? `${destinationCount} lines`
                : config.escalation_number
                  ? "Configured"
                  : "Not set"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
