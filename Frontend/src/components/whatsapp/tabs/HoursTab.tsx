import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsappConfig } from "../WhatsappBuilder";
import { Info } from "lucide-react";

interface HoursTabProps {
  config: Partial<WhatsappConfig>;
  onChange: (updates: Partial<WhatsappConfig>) => void;
}

export function HoursTab({ config, onChange }: HoursTabProps) {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Hours & escalation</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          WhatsApp keeps replying any time of day — this controls what it tells customers outside
          business hours.
        </p>
      </div>

      <div className="flex gap-3 rounded-lg border border-border bg-muted/50 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="text-sm leading-relaxed">
          <strong>Default hours:</strong> Your assistant uses the business hours from your Business
          Profile unless you set special hours here.
        </div>
      </div>

      <div className="space-y-6 pt-2">
        <h3 className="border-b pb-2 text-md font-medium">After-hours behavior</h3>

        <div className="space-y-3">
          <Label>What should the assistant do outside business hours?</Label>
          <Select
            value={config.after_hours_behavior || "take_message"}
            onValueChange={(val) => onChange({ after_hours_behavior: val })}
          >
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="take_message">Keep answering, take messages</SelectItem>
              <SelectItem value="handoff">Flag for a human in the morning</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 pt-2">
          <Label htmlFor="escalation_number">Escalation contact</Label>
          <Input
            id="escalation_number"
            className="w-full sm:w-[300px]"
            placeholder="+1 (555) 000-0000"
            value={config.escalation_number || ""}
            onChange={(e) => onChange({ escalation_number: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Shown to customers who ask for a human, and used for handoff notes.
          </p>
        </div>
      </div>
    </div>
  );
}
