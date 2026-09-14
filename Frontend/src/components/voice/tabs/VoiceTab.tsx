import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VoiceConfig } from "../VoiceBuilder";

interface VoiceTabProps {
  config: Partial<VoiceConfig>;
  onChange: (updates: Partial<VoiceConfig>) => void;
}

// Vapi's preset voice names and models, one enum per provider — keep in sync
// with src/lib/voice.server.ts's VOICE_PROVIDER_* maps.
const VOICE_PRESETS: Record<string, { value: string; label: string }[]> = {
  "11labs": [
    { value: "burt", label: "Burt" },
    { value: "marissa", label: "Marissa" },
    { value: "andrea", label: "Andrea" },
    { value: "sarah", label: "Sarah" },
    { value: "phillip", label: "Phillip" },
    { value: "steve", label: "Steve" },
    { value: "joseph", label: "Joseph" },
    { value: "myra", label: "Myra" },
    { value: "paula", label: "Paula" },
    { value: "ryan", label: "Ryan" },
    { value: "drew", label: "Drew" },
    { value: "paul", label: "Paul" },
    { value: "mrb", label: "Mr. B" },
    { value: "matilda", label: "Matilda" },
    { value: "mark", label: "Mark" },
  ],
  playht: [
    { value: "jennifer", label: "Jennifer" },
    { value: "melissa", label: "Melissa" },
    { value: "will", label: "Will" },
    { value: "chris", label: "Chris" },
    { value: "matt", label: "Matt" },
    { value: "jack", label: "Jack" },
    { value: "ruby", label: "Ruby" },
    { value: "davis", label: "Davis" },
    { value: "donna", label: "Donna" },
    { value: "michael", label: "Michael" },
  ],
  openai: [
    { value: "alloy", label: "Alloy" },
    { value: "echo", label: "Echo" },
    { value: "fable", label: "Fable" },
    { value: "onyx", label: "Onyx" },
    { value: "nova", label: "Nova" },
    { value: "shimmer", label: "Shimmer" },
    { value: "marin", label: "Marin" },
    { value: "cedar", label: "Cedar" },
  ],
};

const DEFAULT_VOICE_ID: Record<string, string> = {
  "11labs": "burt",
  playht: "jennifer",
  openai: "alloy",
};

export function VoiceTab({ config, onChange }: VoiceTabProps) {
  const provider = config.voice_provider || "11labs";
  const presets = VOICE_PRESETS[provider] ?? VOICE_PRESETS["11labs"]!;
  const currentVoiceId = presets.some((p) => p.value === config.voice_id)
    ? config.voice_id!
    : DEFAULT_VOICE_ID[provider]!;

  const changeProvider = (newProvider: string) => {
    // Each provider only accepts its own voice IDs, so switching providers
    // must reset the voice to a valid default for the new one.
    onChange({ voice_provider: newProvider, voice_id: DEFAULT_VOICE_ID[newProvider] ?? null });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Voice & Language</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Select the language and voice characteristics for your receptionist.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Label>Language</Label>
          <Select
            value={config.language || "en"}
            onValueChange={(val) => onChange({ language: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Voice Provider</Label>
          <Select value={provider} onValueChange={changeProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="11labs">ElevenLabs</SelectItem>
              <SelectItem value="playht">PlayHT</SelectItem>
              <SelectItem value="openai">OpenAI (TTS)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Voice</Label>
        <Select value={currentVoiceId} onValueChange={(val) => onChange({ voice_id: val })}>
          <SelectTrigger className="sm:w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presets.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Save and use Test call to hear how this voice sounds.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
          <div className="space-y-0.5 pr-4">
            <Label className="text-base">Auto-detect caller language</Label>
            <p className="text-sm text-muted-foreground">
              Detect whatever language the caller speaks and reply in kind, instead of sticking to
              one fixed language.
            </p>
          </div>
          <Switch
            checked={config.multilingual_enabled === true}
            onCheckedChange={(checked) => onChange({ multilingual_enabled: checked })}
          />
        </div>
        {config.multilingual_enabled ? (
          <p className="px-1 text-xs text-muted-foreground">
            Covers English, Spanish, French, German, Hindi, Russian, Portuguese, Japanese, Italian
            and Dutch. Needs the Deepgram transcriber (set on the Advanced tab) — press Save/Sync
            after changing this.
          </p>
        ) : null}
        {config.multilingual_enabled &&
        (config.transcriber_provider ?? "deepgram") !== "deepgram" ? (
          <p className="px-1 text-xs text-status-attention">
            Your transcriber is set to {config.transcriber_provider} on the Advanced tab, which
            can't detect the caller's language — switch it to Deepgram for this to work.
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <Label className="flex justify-between">
          <span>AI Personality Tone (Temperature)</span>
          <span className="text-muted-foreground">{config.temperature ?? 0.5}</span>
        </Label>
        <Slider
          value={[config.temperature ?? 0.5]}
          min={0}
          max={1}
          step={0.1}
          onValueChange={([val]) => onChange({ temperature: val ?? null })}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>More robotic / strict</span>
          <span>More creative / conversational</span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t">
        <div className="space-y-3">
          <Label>AI Model</Label>
          <Select
            value={config.llm_provider || "openai"}
            onValueChange={(val) => onChange({ llm_provider: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (GPT-4o Mini)</SelectItem>
              <SelectItem value="anthropic">Anthropic (Claude 3 Haiku)</SelectItem>
              <SelectItem value="custom">Custom LLM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
