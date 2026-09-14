import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WhatsappConfig } from "../WhatsappBuilder";

interface PersonaTabProps {
  config: Partial<WhatsappConfig>;
  onChange: (updates: Partial<WhatsappConfig>) => void;
}

export function PersonaTab({ config, onChange }: PersonaTabProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Persona & tone</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Configure how your assistant introduces itself and the tone it replies in.
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="persona_name">Assistant name</Label>
        <Input
          id="persona_name"
          placeholder="e.g. Sarah"
          value={config.persona_name || ""}
          onChange={(e) => onChange({ persona_name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The name it uses when introducing itself in chat.
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="welcome_message">Welcome message</Label>
        <Textarea
          id="welcome_message"
          className="min-h-[100px]"
          placeholder="e.g. Hi! Thanks for messaging Riverside Plumbing. I'm Sarah, an AI assistant here — how can I help?"
          value={config.welcome_message || ""}
          onChange={(e) => onChange({ welcome_message: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Sent (as your first reply) the first time a new customer messages you.
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="bot_personality_prompt">Tone & personality</Label>
        <Textarea
          id="bot_personality_prompt"
          className="min-h-[120px]"
          placeholder="e.g. Friendly and concise. Use short sentences and no emojis. Never make promises about pricing without checking the knowledge base."
          value={config.bot_personality_prompt || ""}
          onChange={(e) => onChange({ bot_personality_prompt: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Extra instructions folded into every reply, on top of your knowledge base.
        </p>
      </div>
    </div>
  );
}
