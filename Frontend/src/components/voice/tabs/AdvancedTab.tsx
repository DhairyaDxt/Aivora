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
import { VoiceConfig } from "../VoiceBuilder";

interface AdvancedTabProps {
  config: Partial<VoiceConfig>;
  onChange: (updates: Partial<VoiceConfig>) => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
      <div className="space-y-0.5 pr-4">
        <Label className="text-base">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function AdvancedTab({ config, onChange }: AdvancedTabProps) {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Advanced call behavior</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Fine-tune how the call opens, how interruptions are handled, and what happens when it
          ends.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Label>Who speaks first</Label>
          <Select
            value={config.first_message_mode || "assistant-speaks-first"}
            onValueChange={(val) => onChange({ first_message_mode: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="assistant-speaks-first">Assistant greets first</SelectItem>
              <SelectItem value="assistant-waits-for-user">Wait for caller to speak</SelectItem>
              <SelectItem value="assistant-speaks-first-with-model-generated-message">
                AI-generated opener
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Background ambience</Label>
          <Select
            value={config.background_sound || "office"}
            onValueChange={(val) => onChange({ background_sound: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="office">Office noise</SelectItem>
              <SelectItem value="off">Silent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h3 className="text-md font-medium">Recording & interruptions</h3>

        <ToggleRow
          label="Record calls"
          description="Save an audio recording of every call, playable from the Calls page."
          checked={config.recording_enabled !== false}
          onCheckedChange={(checked) => onChange({ recording_enabled: checked })}
        />

        <ToggleRow
          label="Let callers interrupt"
          description="If off, the assistant finishes its sentence before listening, which feels calmer but slower."
          checked={config.barge_in_enabled !== false}
          onCheckedChange={(checked) => onChange({ barge_in_enabled: checked })}
        />

        <ToggleRow
          label="Auto-summarize calls"
          description="Generate a one-line summary of each call, shown on the Calls page."
          checked={config.call_summary_enabled !== false}
          onCheckedChange={(checked) => onChange({ call_summary_enabled: checked })}
        />
      </div>

      <div className="space-y-4 border-t pt-6">
        <h3 className="text-md font-medium">Voicemail detection</h3>
        <ToggleRow
          label="Detect voicemail"
          description="When calling out (e.g. reminders), leave a message instead of talking to an answering machine."
          checked={config.voicemail_detection_enabled === true}
          onCheckedChange={(checked) => onChange({ voicemail_detection_enabled: checked })}
        />
        {config.voicemail_detection_enabled ? (
          <div className="space-y-3">
            <Label htmlFor="voicemail_message">Voicemail message</Label>
            <Textarea
              id="voicemail_message"
              placeholder="Sorry we missed you. Please call back or leave a message and we'll get back to you."
              value={config.voicemail_message ?? ""}
              onChange={(e) => onChange({ voicemail_message: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-4 border-t pt-6">
        <h3 className="text-md font-medium">Ending the call</h3>
        <ToggleRow
          label="Let the assistant hang up"
          description={
            'Recognize phrases like "goodbye" or "that\'s all, thanks" and end the call automatically.'
          }
          checked={config.end_call_phrases_enabled === true}
          onCheckedChange={(checked) => onChange({ end_call_phrases_enabled: checked })}
        />
        {config.end_call_phrases_enabled ? (
          <div className="space-y-3">
            <Label htmlFor="end_call_message">Sign-off message</Label>
            <Input
              id="end_call_message"
              placeholder="Thanks for calling, goodbye!"
              value={config.end_call_message ?? ""}
              onChange={(e) => onChange({ end_call_message: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-4 border-t pt-6">
        <h3 className="text-md font-medium">Speech recognition</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <Label>Transcriber</Label>
            <Select
              value={config.transcriber_provider || "deepgram"}
              onValueChange={(val) => onChange({ transcriber_provider: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deepgram">Deepgram</SelectItem>
                <SelectItem value="assembly-ai">AssemblyAI</SelectItem>
                <SelectItem value="azure">Azure Speech</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label htmlFor="transcriber_language">Caller language</Label>
            <Input
              id="transcriber_language"
              placeholder="en"
              value={config.transcriber_language ?? "en"}
              onChange={(e) => onChange({ transcriber_language: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              BCP-47 code, e.g. "en", "es", "fr", "hi".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
