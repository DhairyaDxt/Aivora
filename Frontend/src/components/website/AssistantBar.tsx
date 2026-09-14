import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Send, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
  changes?: string[];
  /** Set on the latest assistant turn that actually changed something. */
  canUndo?: boolean;
  pendingDelete?: { pageId: string; pageName: string } | null;
};

const SUGGESTIONS = [
  "Make the homepage headline shorter",
  "Use a deep green as the primary color",
  "Add a pricing page",
];

export function AssistantBar({
  messages,
  busy,
  onSend,
  onUndo,
  onConfirmDelete,
  onDismissDelete,
}: {
  messages: AssistantMessage[];
  busy: boolean;
  onSend: (message: string) => void;
  onUndo: () => void;
  onConfirmDelete: (pageId: string) => void;
  onDismissDelete: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    onSend(text);
  };

  const pending = messages.at(-1)?.pendingDelete ?? null;

  return (
    <div className="rounded-xl border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-[var(--grad-to)]" />
          Ask AI to change your site
        </span>
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="border-t">
          <div ref={scrollRef} className="max-h-52 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Describe a change in plain English — it edits your draft, and you can undo it.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => onSend(s)}
                      disabled={busy}
                      className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "text-sm",
                      message.role === "user" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span className="mr-2 text-xs font-semibold tracking-wide uppercase opacity-60">
                      {message.role === "user" ? "You" : "AI"}
                    </span>
                    {message.text}

                    {message.changes && message.changes.length > 0 ? (
                      <ul className="mt-1.5 space-y-0.5 pl-6">
                        {message.changes.map((change, i) => (
                          <li key={i} className="text-xs text-foreground/80">
                            · {change}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {message.canUndo && index === messages.length - 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 gap-1.5 px-2 text-xs"
                        onClick={onUndo}
                        disabled={busy}
                      >
                        <Undo2 className="size-3.5" /> Undo these changes
                      </Button>
                    ) : null}
                  </div>
                ))}
                {busy ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Working on it…
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {pending ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-status-attention/10 px-4 py-2.5">
              <p className="text-sm text-status-attention">
                Delete the “{pending.pageName}” page? This can't be undone.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={onDismissDelete} disabled={busy}>
                  Keep it
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onConfirmDelete(pending.pageId)}
                  disabled={busy}
                >
                  Delete page
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. rewrite the about section to mention we're family-run"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={busy}
            />
            <Button size="icon" onClick={send} disabled={busy || !draft.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
