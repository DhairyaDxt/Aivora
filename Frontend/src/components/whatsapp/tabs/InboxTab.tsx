import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  listWhatsappConversations,
  listWhatsappMessages,
  sendWhatsappOwnerReply,
  handBackToAi,
} from "@/lib/whatsapp.functions";
import { Send, Bot, UserRound } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-status-live/12 text-status-live border-status-live/30",
  escalated: "bg-status-attention/12 text-status-attention border-status-attention/30",
  resolved: "bg-muted text-muted-foreground border-border",
};

export function InboxTab({ serviceId }: { serviceId: string }) {
  const queryClient = useQueryClient();
  const listConversations = useServerFn(listWhatsappConversations);
  const listMessages = useServerFn(listWhatsappMessages);
  const sendReply = useServerFn(sendWhatsappOwnerReply);
  const returnToAi = useServerFn(handBackToAi);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const conversationsQuery = useQuery({
    queryKey: ["whatsapp-conversations", serviceId],
    queryFn: () => listConversations({ data: { serviceId } }),
    refetchInterval: 10_000,
  });

  const messagesQuery = useQuery({
    queryKey: ["whatsapp-messages", selectedId],
    queryFn: () => listMessages({ data: { conversationId: selectedId! } }),
    enabled: !!selectedId,
    refetchInterval: 10_000,
  });

  const conversations = conversationsQuery.data ?? [];
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const send = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      await sendReply({ data: { conversationId: selectedId, message: draft.trim() } });
      setDraft("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedId] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations", serviceId] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that reply.");
    } finally {
      setSending(false);
    }
  };

  const handBack = async () => {
    if (!selectedId) return;
    try {
      await returnToAi({ data: { conversationId: selectedId } });
      toast.success("Handed back to the AI.");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations", serviceId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not hand this back.");
    }
  };

  return (
    <div className="grid h-[560px] grid-cols-1 gap-4 sm:grid-cols-[280px_1fr]">
      <div className="overflow-y-auto rounded-lg border">
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No WhatsApp conversations yet. They'll show up here once customers start messaging you.
          </p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={cn(
                "flex w-full flex-col gap-1 border-b px-4 py-3 text-left text-sm hover:bg-accent/50",
                selectedId === c.id && "bg-accent",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.customerIdentifier ?? "Unknown"}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                    STATUS_STYLES[c.status ?? "active"] ?? STATUS_STYLES["active"],
                  )}
                >
                  {c.status ?? "active"}
                </span>
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {c.lastMessage ?? "No messages yet"}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border">
        {!selected ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Select a conversation to view it.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-medium">{selected.customerIdentifier}</p>
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                    STATUS_STYLES[selected.status ?? "active"] ?? STATUS_STYLES["active"],
                  )}
                >
                  {selected.status ?? "active"}
                </span>
              </div>
              {selected.status === "escalated" ? (
                <Button variant="outline" size="sm" onClick={handBack}>
                  Hand back to AI
                </Button>
              ) : null}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {(messagesQuery.data ?? []).map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-start gap-2",
                    m.sender === "customer" ? "" : "flex-row-reverse text-right",
                  )}
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    {m.sender === "customer" ? (
                      <UserRound className="size-3.5" />
                    ) : (
                      <Bot className="size-3.5" />
                    )}
                  </span>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                      m.sender === "customer" ? "bg-muted" : "bg-primary/10",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-2 border-t p-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Reply as the business…"
                className="min-h-[44px] flex-1 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button size="icon" onClick={send} disabled={sending || !draft.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
