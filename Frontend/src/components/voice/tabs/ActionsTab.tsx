import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { VoiceConfig } from "../VoiceBuilder";
import { Calendar, PhoneForwarded, MessageSquare, Clock, Plus, Trash2 } from "lucide-react";

interface ActionsTabProps {
  config: Partial<VoiceConfig>;
  onChange: (updates: Partial<VoiceConfig>) => void;
}

type TransferDestination = { name: string; number: string; description?: string };

export function ActionsTab({ config, onChange }: ActionsTabProps) {
  // Parse functions_enabled safely
  const functions = (config.functions_enabled as Record<string, boolean>) || {
    check_availability: true,
    book_appointment: true,
    transfer_call: true,
    take_message: true,
  };

  const destinations = ((config.transfer_destinations as TransferDestination[] | null) ?? []).map(
    (d) => ({ name: d.name ?? "", number: d.number ?? "", description: d.description ?? "" }),
  );

  const handleToggle = (key: string, checked: boolean) => {
    onChange({
      functions_enabled: {
        ...functions,
        [key]: checked,
      },
    });
  };

  const updateDestinations = (next: TransferDestination[]) => {
    onChange({ transfer_destinations: next });
  };

  const addDestination = () => {
    updateDestinations([...destinations, { name: "", number: "", description: "" }]);
  };

  const removeDestination = (index: number) => {
    updateDestinations(destinations.filter((_, i) => i !== index));
  };

  const editDestination = (index: number, patch: Partial<TransferDestination>) => {
    updateDestinations(destinations.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Actions & Tools</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Define what tools and actions the receptionist can use during a call. Enable or disable
          capabilities based on your needs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm bg-card hover:bg-accent/5 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <Label className="text-base cursor-pointer">Check Availability</Label>
            </div>
            <Switch
              checked={functions["check_availability"] !== false}
              onCheckedChange={(c) => handleToggle("check_availability", c)}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Allows the assistant to check business hours or calendar slots.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm bg-card hover:bg-accent/5 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <Label className="text-base cursor-pointer">Book Appointment</Label>
            </div>
            <Switch
              checked={functions["book_appointment"] !== false}
              onCheckedChange={(c) => handleToggle("book_appointment", c)}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Enables the assistant to schedule meetings directly on your calendar.
          </p>
          <p className="text-xs text-muted-foreground">
            Needs a{" "}
            <Link to="/dashboard/connections" className="underline underline-offset-2">
              Calendly connection
            </Link>{" "}
            — otherwise it just takes a message.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm bg-card hover:bg-accent/5 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneForwarded className="size-4 text-muted-foreground" />
              <Label className="text-base cursor-pointer">Transfer Call</Label>
            </div>
            <Switch
              checked={functions["transfer_call"] !== false}
              onCheckedChange={(c) => handleToggle("transfer_call", c)}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            The assistant can forward the call to a human agent when requested.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm bg-card hover:bg-accent/5 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-muted-foreground" />
              <Label className="text-base cursor-pointer">Take Message</Label>
            </div>
            <Switch
              checked={functions["take_message"] !== false}
              onCheckedChange={(c) => handleToggle("take_message", c)}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Assistant will transcribe messages and email/SMS them to you.
          </p>
        </div>
      </div>

      {functions["transfer_call"] !== false ? (
        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-md font-medium">Live agent lines</h3>
              <p className="text-sm text-muted-foreground">
                Give the assistant named lines to choose between (e.g. Sales vs. Support). Leave
                empty to use the single escalation number from the Hours tab instead.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addDestination}>
              <Plus className="mr-1 size-4" /> Add line
            </Button>
          </div>

          {destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No named lines yet — using the Hours tab escalation number for every transfer.
            </p>
          ) : (
            <div className="space-y-3">
              {destinations.map((d, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
                >
                  <Input
                    placeholder="Name (e.g. Sales)"
                    value={d.name}
                    onChange={(e) => editDestination(i, { name: e.target.value })}
                  />
                  <Input
                    placeholder="+1 (555) 000-0000"
                    value={d.number}
                    onChange={(e) => editDestination(i, { number: e.target.value })}
                  />
                  <Input
                    placeholder="When to use this line (e.g. billing questions)"
                    value={d.description}
                    onChange={(e) => editDestination(i, { description: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDestination(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
            <div className="space-y-0.5 pr-4">
              <Label className="text-base">Warm transfer</Label>
              <p className="text-sm text-muted-foreground">
                Brief the human with an AI-generated call summary before connecting the caller,
                instead of a silent blind transfer.
              </p>
            </div>
            <Switch
              checked={config.warm_transfer_enabled !== false}
              onCheckedChange={(checked) => onChange({ warm_transfer_enabled: checked })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
