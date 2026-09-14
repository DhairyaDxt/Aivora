import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { WhatsappConfig } from "../WhatsappBuilder";
import { Calendar, Clock, MessageSquare, UserRound, X } from "lucide-react";
import { useState } from "react";

interface ActionsTabProps {
  config: Partial<WhatsappConfig>;
  onChange: (updates: Partial<WhatsappConfig>) => void;
}

const DEFAULT_FUNCTIONS = {
  check_availability: true,
  book_appointment: true,
  take_message: true,
  request_human_handoff: true,
};

export function ActionsTab({ config, onChange }: ActionsTabProps) {
  const functions = (config.functions_enabled as Record<string, boolean>) || DEFAULT_FUNCTIONS;
  const keywords = config.human_handoff_keywords ?? [];
  const [newKeyword, setNewKeyword] = useState("");

  const handleToggle = (key: string, checked: boolean) => {
    onChange({ functions_enabled: { ...functions, [key]: checked } });
  };

  const addKeyword = () => {
    const value = newKeyword.trim().toLowerCase();
    if (!value || keywords.includes(value)) return;
    onChange({ human_handoff_keywords: [...keywords, value] });
    setNewKeyword("");
  };

  const removeKeyword = (value: string) => {
    onChange({ human_handoff_keywords: keywords.filter((k) => k !== value) });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Actions & tools</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Define what the assistant can do while chatting with a customer.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <Label className="text-base">Check availability</Label>
            </div>
            <Switch
              checked={functions["check_availability"] !== false}
              onCheckedChange={(c) => handleToggle("check_availability", c)}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Looks up real open slots when a customer asks about booking.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <Label className="text-base">Book appointment</Label>
            </div>
            <Switch
              checked={functions["book_appointment"] !== false}
              onCheckedChange={(c) => handleToggle("book_appointment", c)}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Books directly on your calendar.</p>
          <p className="text-xs text-muted-foreground">
            Needs a{" "}
            <Link to="/dashboard/connections" className="underline underline-offset-2">
              Calendly connection
            </Link>{" "}
            — otherwise it just takes a message.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-muted-foreground" />
              <Label className="text-base">Take a message</Label>
            </div>
            <Switch
              checked={functions["take_message"] !== false}
              onCheckedChange={(c) => handleToggle("take_message", c)}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Records details for the business to follow up on.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              <Label className="text-base">Human handoff</Label>
            </div>
            <Switch
              checked={functions["request_human_handoff"] !== false}
              onCheckedChange={(c) => handleToggle("request_human_handoff", c)}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Lets the AI flag a thread for a team member instead of guessing.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="text-md font-medium">Handoff keywords</h3>
          <p className="text-sm text-muted-foreground">
            If a customer's message contains any of these words, the AI stops replying and the
            conversation is flagged in your Inbox for a team member — no LLM call needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keywords yet.</p>
          ) : (
            keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1 py-1 pr-1">
                {kw}
                <button
                  type="button"
                  onClick={() => removeKeyword(kw)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. refund, manager, human"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            className="max-w-xs"
          />
          <button
            type="button"
            onClick={addKeyword}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
