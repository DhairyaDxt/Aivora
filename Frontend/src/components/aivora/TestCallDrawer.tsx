import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import type VapiClient from "@vapi-ai/web";
import { getVoicePublicKey, startTestCall, runTestCallTool } from "@/lib/voice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Mic, PhoneOutgoing, Square } from "lucide-react";
import { Waveform } from "@/components/aivora/Waveform";

type Line = { role: string; text: string };

export function TestCallDrawer({
  open,
  onOpenChange,
  serviceId,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  serviceId: string;
}) {
  const start = useServerFn(startTestCall);
  const publicKey = useServerFn(getVoicePublicKey);
  const runTool = useServerFn(runTestCallTool);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [toNumber, setToNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const vapiRef = useRef<VapiClient | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) stopWeb();
  }, [open]);

  function stopWeb() {
    try {
      vapiRef.current?.stop();
    } catch {
      /* already stopped */
    }
    vapiRef.current = null;
    setStatus((current) => (current === "live" || current === "connecting" ? "ended" : current));
  }

  const startWebCall = async () => {
    setBusy(true);
    setLines([]);
    try {
      const [{ publicKey: key }, session] = await Promise.all([
        publicKey({}),
        start({ data: { serviceId, mode: "web" } }),
      ]);
      if (!key) throw new Error("Browser calling isn't available right now.");
      if (session.mode !== "web" || !session.assistantId)
        throw new Error("Save your receptionist first.");

      // @vapi-ai/web ships as CommonJS. Depending on the bundler's interop,
      // the resolved default export can end up double-wrapped (an object
      // whose own .default is the real class) rather than the class itself
      // - unwrap defensively instead of assuming one exact shape.
      const mod: unknown = await import("@vapi-ai/web");
      const VapiCtor = [
        (mod as { default?: unknown }).default,
        (mod as { default?: { default?: unknown } }).default?.default,
      ].find(
        (candidate): candidate is new (key: string) => VapiClient =>
          typeof candidate === "function",
      );
      if (!VapiCtor) throw new Error("Could not load the voice calling library.");

      conversationIdRef.current = session.conversationId ?? null;

      const vapi = new VapiCtor(key);
      vapiRef.current = vapi;
      setStatus("connecting");

      vapi.on("call-start", () => setStatus("live"));
      vapi.on("call-end", () => setStatus("ended"));
      vapi.on("error", () => {
        setStatus("ended");
        toast.error("The test call dropped.");
      });
      vapi.on(
        "message",
        (message: {
          type?: string;
          role?: string;
          transcript?: string;
          transcriptType?: string;
          toolCallList?: Array<{ id: string; function: { name: string; arguments?: unknown } }>;
        }) => {
          if (message.type === "transcript" && message.transcriptType === "final") {
            setLines((current) => [
              ...current,
              {
                role: message.role === "user" ? "You" : "Receptionist",
                text: message.transcript ?? "",
              },
            ]);
            return;
          }

          // Vapi's cloud can't reach "localhost", so the assistant was synced
          // with no server URL and function tools fall back to client-side
          // delivery here instead of a webhook (see buildAssistantPayload).
          // The model can't see a "result" directly - addMessage() is the
          // documented workaround for feeding one back into its context.
          if (message.type === "tool-calls" && message.toolCallList?.length) {
            const conversationId = conversationIdRef.current;
            for (const toolCall of message.toolCallList) {
              void (async () => {
                let args: Record<string, unknown> = {};
                const raw = toolCall.function.arguments;
                if (typeof raw === "string") {
                  try {
                    args = raw ? JSON.parse(raw) : {};
                  } catch {
                    args = {};
                  }
                } else if (raw && typeof raw === "object") {
                  args = raw as Record<string, unknown>;
                }

                let resultText = "Something went wrong running that.";
                if (conversationId) {
                  try {
                    const { result } = await runTool({
                      data: {
                        serviceId,
                        conversationId,
                        name: toolCall.function.name,
                        arguments: args,
                      },
                    });
                    resultText = result;
                  } catch (error) {
                    resultText =
                      error instanceof Error ? error.message : "Something went wrong running that.";
                  }
                }

                setLines((current) => [
                  ...current,
                  { role: "Tool", text: `${toolCall.function.name} → ${resultText}` },
                ]);

                const addMessage = (
                  vapi as unknown as {
                    addMessage?: (message: { role: string; content: string }) => void;
                  }
                ).addMessage;
                if (typeof addMessage === "function") {
                  addMessage.call(vapi, {
                    role: "system",
                    content: `Result of ${toolCall.function.name}: ${resultText}`,
                  });
                }
              })();
            }
          }
        },
      );

      await vapi.start(session.assistantId);
    } catch (error) {
      setStatus("idle");
      toast.error(error instanceof Error ? error.message : "Could not start the test call.");
    } finally {
      setBusy(false);
    }
  };

  const startPhoneCall = async () => {
    setBusy(true);
    try {
      await start({ data: { serviceId, mode: "phone", toNumber } });
      toast.success("Calling you now. Answer to talk to your receptionist.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not place the call.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Test your receptionist</SheetTitle>
          <SheetDescription>Test calls are kept separate from your real calls.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="panel space-y-4 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Talk in your browser</p>
              {status === "live" ? <Waveform className="text-foreground" /> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {status === "live"
                ? "Connected. Start talking."
                : status === "connecting"
                  ? "Connecting…"
                  : status === "ended"
                    ? "Call ended."
                    : "Uses your microphone."}
            </p>
            {status === "live" || status === "connecting" ? (
              <Button variant="destructive" className="w-full gap-2" onClick={stopWeb}>
                <Square className="size-4" /> End call
              </Button>
            ) : (
              <Button className="w-full gap-2" onClick={startWebCall} disabled={busy}>
                <Mic className="size-4" /> Start browser call
              </Button>
            )}
          </div>

          <div className="panel mt-5 space-y-3 p-4">
            <p className="text-sm font-medium">Or call your phone</p>
            <div className="space-y-2">
              <Label htmlFor="test-number">Your phone number</Label>
              <Input
                id="test-number"
                value={toNumber}
                onChange={(e) => setToNumber(e.target.value)}
                placeholder="+1 555 123 4567"
              />
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={startPhoneCall}
              disabled={busy || !toNumber}
            >
              <PhoneOutgoing className="size-4" /> Call me
            </Button>
          </div>

          {lines.length > 0 ? (
            <div className="panel mt-5 space-y-3 p-4">
              <p className="text-sm font-medium">Live transcript</p>
              {lines.map((line, index) => (
                <p key={index} className="text-sm">
                  <span className="text-muted-foreground">{line.role}: </span>
                  {line.text}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
