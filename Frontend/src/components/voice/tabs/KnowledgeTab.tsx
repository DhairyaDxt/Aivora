import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrg } from "@/hooks/useOrg";
import { parseKnowledgeText } from "@/lib/knowledge.functions";

const MIN_LENGTH = 50;

export function KnowledgeTab() {
  const { data: org } = useOrg();
  const parse = useServerFn(parseKnowledgeText);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    entries_created: number;
    entries: Array<{ id: string; title: string | null; type: string }>;
  } | null>(null);

  const submit = async () => {
    if (!org) {
      toast.error("Finish business onboarding first.");
      return;
    }
    if (text.trim().length < MIN_LENGTH) {
      toast.error(`Write at least ${MIN_LENGTH} characters about the business.`);
      return;
    }
    setSubmitting(true);
    setLastResult(null);
    try {
      const result = await parse({ data: { orgId: org.id, text } });
      setLastResult(result);
      setText("");
      toast.success(
        `Added ${result.entries_created} knowledge base ${
          result.entries_created === 1 ? "entry" : "entries"
        }.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not extract knowledge from that text.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Complete business prompt</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Paste everything about your business in one go — services, pricing, hours, policies, FAQs,
          whatever comes to mind. We'll read it and automatically split it into knowledge base
          entries your receptionist can use on calls.
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="kb-prompt">Tell us about your business</Label>
        <Textarea
          id="kb-prompt"
          className="min-h-[280px]"
          placeholder={
            "e.g. Riverside Plumbing is open Mon-Fri 8am-6pm and Sat 9am-2pm. We charge a $75 " +
            "callout fee plus $120/hour for labor. Emergency callouts after hours cost double. " +
            "We do not work on gas lines. If a caller asks for a refund, take a message for the " +
            "owner instead of promising one..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{text.trim().length} characters</p>
      </div>

      <Button onClick={submit} disabled={submitting || text.trim().length < MIN_LENGTH}>
        {submitting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 size-4" />
        )}
        {submitting ? "Extracting..." : "Extract to knowledge base"}
      </Button>

      {lastResult ? (
        <div className="space-y-2 rounded-xl border p-4">
          <p className="text-sm font-medium">
            Added {lastResult.entries_created}{" "}
            {lastResult.entries_created === 1 ? "entry" : "entries"}:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {lastResult.entries.map((entry) => (
              <li key={entry.id}>
                <span className="font-medium text-foreground">{entry.title ?? "Untitled"}</span> —{" "}
                {entry.type}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Review these on the Knowledge base page before going live.
          </p>
        </div>
      ) : null}
    </div>
  );
}
