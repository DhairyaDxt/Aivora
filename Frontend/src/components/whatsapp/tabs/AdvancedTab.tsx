import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { WhatsappConfig } from "../WhatsappBuilder";
import { LLM_MODELS } from "@/lib/aivora";

interface AdvancedTabProps {
  config: Partial<WhatsappConfig>;
  onChange: (updates: Partial<WhatsappConfig>) => void;
}

export function AdvancedTab({ config, onChange }: AdvancedTabProps) {
  const provider = config.llm_provider || "gemini";

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Advanced</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Fine-tune the model powering replies and knowledge base behavior.
        </p>
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
        <div className="space-y-0.5 pr-4">
          <Label className="text-base">Use knowledge base</Label>
          <p className="text-sm text-muted-foreground">
            Let the assistant search your knowledge base to answer questions.
          </p>
        </div>
        <Switch
          checked={config.kb_enabled !== false}
          onCheckedChange={(checked) => onChange({ kb_enabled: checked })}
        />
      </div>

      <div className="grid gap-6 border-t pt-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Label>Model provider</Label>
          <Select
            value={provider}
            onValueChange={(val) =>
              onChange({
                llm_provider: val,
                llm_model:
                  val === "anthropic"
                    ? "claude-3-5-sonnet-20241022"
                    : val === "gemini"
                      ? "gemini-2.5-flash"
                      : "gpt-4o-mini",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Gemini (free tier)</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Model</Label>
          {provider === "anthropic" ? (
            <Select
              value={config.llm_model || "claude-3-5-sonnet-20241022"}
              onValueChange={(val) => onChange({ llm_model: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-3-5-haiku-20241022">Fast and affordable</SelectItem>
                <SelectItem value="claude-3-5-sonnet-20241022">Most capable</SelectItem>
              </SelectContent>
            </Select>
          ) : provider === "gemini" ? (
            <Select
              value={config.llm_model || "gemini-2.5-flash"}
              onValueChange={(val) => onChange({ llm_model: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-2.5-flash-lite">Fastest, cheapest</SelectItem>
                <SelectItem value="gemini-2.5-flash">Fast and affordable</SelectItem>
                <SelectItem value="gemini-2.5-pro">Most capable</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={config.llm_model || "gpt-4o-mini"}
              onValueChange={(val) => onChange({ llm_model: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t pt-6">
        <div className="flex items-center justify-between">
          <Label>Reply creativity</Label>
          <span className="text-sm text-muted-foreground">{config.temperature ?? 0.5}</span>
        </div>
        <Slider
          value={[config.temperature ?? 0.5]}
          min={0}
          max={1}
          step={0.1}
          onValueChange={([val]) => {
            if (val !== undefined) onChange({ temperature: val });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Lower keeps answers predictable and on-script; higher sounds more conversational.
        </p>
      </div>
    </div>
  );
}
