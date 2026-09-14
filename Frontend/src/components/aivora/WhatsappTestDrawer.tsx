import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { sendWhatsappTestMessage } from "@/lib/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Send, Bot, UserRound } from "lucide-react";

type Line = { role: "customer" | "ai"; text: string };

export function WhatsappTestDrawer({
  open,
  onOpenChange,
  serviceId,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  serviceId: string;
}) {
  const sendTest = useServerFn(sendWhatsappTestMessage);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!draft.trim()) return;
    const message = draft.trim();
    setDraft("");
    setSending(true);
    try {
      const result = await sendTest({ data: { serviceId, message } });
      setLines(result.messages);
      if (result.escalated) {
        toast.info("This would hand off to a human — check the Inbox tab.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reach the assistant.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Simulate a WhatsApp chat</SheetTitle>
          <SheetDescription>
            Chat with your assistant here — nothing is sent over real WhatsApp.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden px-4 py-4">
          <div className="flex-1 space-y-3 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Send a message to start testing.</p>
            ) : (
              lines.map((line, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-2",
                    line.role === "customer" ? "flex-row-reverse text-right" : "",
                  )}
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    {line.role === "customer" ? (
                      <UserRound className="size-3.5" />
                    ) : (
                      <Bot className="size-3.5" />
                    )}
                  </span>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      line.role === "customer" ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    {line.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type as a customer…"
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
