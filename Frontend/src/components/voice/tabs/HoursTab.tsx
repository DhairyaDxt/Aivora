import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VoiceConfig } from "../VoiceBuilder";
import { Info } from "lucide-react";

interface HoursTabProps {
  config: Partial<VoiceConfig>;
  onChange: (updates: Partial<VoiceConfig>) => void;
}

export function HoursTab({ config, onChange }: HoursTabProps) {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Hours & Escalation</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Set business hours and define how to handle calls outside these times.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-4 flex gap-3">
        <Info className="size-5 shrink-0 text-muted-foreground mt-0.5" />
        <div className="text-sm leading-relaxed">
          <strong>Default Hours:</strong> Your receptionist automatically uses the business hours
          defined in your Business Profile. If you need special hours just for this receptionist,
          you can configure overrides here in a future update.
        </div>
      </div>

      <div className="space-y-6 pt-4">
        <h3 className="text-md font-medium border-b pb-2">After-Hours Behavior</h3>

        <div className="space-y-3">
          <Label>What should the receptionist do after hours?</Label>
          <Select
            value={config.after_hours_behavior || "voicemail"}
            onValueChange={(val) => onChange({ after_hours_behavior: val })}
          >
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="voicemail">Take a Voicemail</SelectItem>
              <SelectItem value="disconnect">Politely Disconnect</SelectItem>
              <SelectItem value="transfer">Transfer to Escalation Number</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 pt-2">
          <Label htmlFor="escalation_number">Escalation / Emergency Number</Label>
          <Input
            id="escalation_number"
            className="w-full sm:w-[300px]"
            placeholder="+1 (555) 000-0000"
            value={config.escalation_number || ""}
            onChange={(e) => onChange({ escalation_number: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            The phone number where high-priority calls or after-hours transfers will be routed.
          </p>
        </div>
      </div>
    </div>
  );
}
