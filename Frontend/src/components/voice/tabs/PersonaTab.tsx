import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { VoiceConfig } from "../VoiceBuilder";

interface PersonaTabProps {
  config: Partial<VoiceConfig>;
  onChange: (updates: Partial<VoiceConfig>) => void;
}

export function PersonaTab({ config, onChange }: PersonaTabProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Persona & Script</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Configure how your receptionist introduces itself and its primary instructions.
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="persona_name">Assistant Name</Label>
        <Input
          id="persona_name"
          placeholder="e.g. Sarah"
          value={config.persona_name || ""}
          onChange={(e) => onChange({ persona_name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">This is the name callers will hear.</p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="greeting_script">Greeting Script</Label>
        <Textarea
          id="greeting_script"
          className="min-h-[120px]"
          placeholder="e.g. Hello, thank you for calling Riverside Plumbing. My name is Sarah. How can I help you today?"
          value={config.greeting_script || ""}
          onChange={(e) => onChange({ greeting_script: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The very first thing the assistant says when picking up the phone.
        </p>
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
        <div className="space-y-0.5">
          <Label className="text-base">Consent Message</Label>
          <p className="text-sm text-muted-foreground">
            Play an automated recording consent message before the greeting.
          </p>
        </div>
        <Switch
          checked={config.consent_enabled !== false} // defaults to true usually
          onCheckedChange={(checked) => onChange({ consent_enabled: checked })}
        />
      </div>

      {config.consent_enabled !== false && (
        <div className="space-y-3">
          <Label htmlFor="consent_message">Consent Audio Text</Label>
          <Textarea
            id="consent_message"
            placeholder="e.g. This call may be recorded and you are speaking with an AI assistant."
            value={
              config.consent_message ||
              "This call may be recorded and you are speaking with an AI assistant."
            }
            onChange={(e) => onChange({ consent_message: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
