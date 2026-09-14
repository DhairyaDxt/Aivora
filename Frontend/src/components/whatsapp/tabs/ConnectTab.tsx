import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWhatsappEmbeddedSignupConfig,
  getWhatsappStatus,
  completeMetaEmbeddedSignup,
  connectWhatsappManual,
  disconnectWhatsapp,
} from "@/lib/whatsapp.functions";
import { MessageCircle, Loader2 } from "lucide-react";

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        version: string;
        xfbml?: boolean;
        cookie?: boolean;
      }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } | null }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const FB_SDK_ID = "facebook-jssdk";

function loadFacebookSdk(appId: string): Promise<void> {
  return new Promise((resolve) => {
    if (window.FB) {
      resolve();
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, version: "v21.0", xfbml: false, cookie: true });
      resolve();
    };
    if (document.getElementById(FB_SDK_ID)) return;
    const script = document.createElement("script");
    script.id = FB_SDK_ID;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  });
}

export function ConnectTab({
  serviceId,
  onConnected,
}: {
  serviceId: string;
  onConnected: () => void;
}) {
  const queryClient = useQueryClient();
  const getConfig = useServerFn(getWhatsappEmbeddedSignupConfig);
  const getStatus = useServerFn(getWhatsappStatus);
  const completeSignup = useServerFn(completeMetaEmbeddedSignup);
  const connectManual = useServerFn(connectWhatsappManual);
  const disconnect = useServerFn(disconnectWhatsapp);

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualWaba, setManualWaba] = useState("");
  const [manualPhoneId, setManualPhoneId] = useState("");
  const [manualToken, setManualToken] = useState("");

  const sessionInfoRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  const configQuery = useQuery({
    queryKey: ["whatsapp-embedded-config"],
    queryFn: () => getConfig({}),
  });

  const statusQuery = useQuery({
    queryKey: ["whatsapp-status", serviceId],
    queryFn: () => getStatus({ data: { serviceId } }),
  });

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA") {
          sessionInfoRef.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
          };
        }
      } catch {
        // not a JSON embedded-signup message; ignore
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-status", serviceId] });
    onConnected();
  };

  const startEmbeddedSignup = async () => {
    const cfg = configQuery.data;
    if (!cfg?.available || !cfg.appId || !cfg.configId) return;
    setConnecting(true);
    sessionInfoRef.current = {};
    try {
      await loadFacebookSdk(cfg.appId);
      window.FB?.login(
        (response) => {
          void (async () => {
            const code = response.authResponse?.code;
            const { wabaId, phoneNumberId } = sessionInfoRef.current;
            if (!code || !wabaId || !phoneNumberId) {
              setConnecting(false);
              toast.error("The Facebook connection window was closed before finishing setup.");
              return;
            }
            try {
              await completeSignup({ data: { serviceId, code, wabaId, phoneNumberId } });
              toast.success("WhatsApp connected.");
              await refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not connect WhatsApp.");
            } finally {
              setConnecting(false);
            }
          })();
        },
        {
          config_id: cfg.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
        },
      );
    } catch (error) {
      setConnecting(false);
      toast.error(
        error instanceof Error ? error.message : "Could not load Facebook's connect flow.",
      );
    }
  };

  const submitManual = async () => {
    if (!manualWaba.trim() || !manualPhoneId.trim() || !manualToken.trim()) {
      toast.error("Fill in all three fields.");
      return;
    }
    setConnecting(true);
    try {
      await connectManual({
        data: {
          serviceId,
          wabaId: manualWaba.trim(),
          phoneNumberId: manualPhoneId.trim(),
          accessToken: manualToken.trim(),
        },
      });
      toast.success("WhatsApp connected.");
      setManualWaba("");
      setManualPhoneId("");
      setManualToken("");
      setShowManual(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect that account.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnect({ data: { serviceId } });
      toast.success("WhatsApp disconnected.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  const status = statusQuery.data;
  const embeddedAvailable = configQuery.data?.available === true;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Connect WhatsApp</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Connect the WhatsApp Business Account you want your assistant to answer on.
        </p>
      </div>

      <div className="rounded-xl border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] text-white">
              <MessageCircle className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold">WhatsApp Business Account</h3>
              <p className="text-sm text-muted-foreground">
                Powers real customer replies for this assistant.
              </p>
            </div>
          </div>
          {status?.connected ? (
            <span className="rounded-full border border-status-live/30 bg-status-live/12 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-status-live">
              Connected
            </span>
          ) : status?.connectionStatus === "error" ? (
            <span className="rounded-full border border-status-attention/30 bg-status-attention/12 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-status-attention">
              Error
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
              Not connected
            </span>
          )}
        </div>

        {status?.connected ? (
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-muted-foreground">Business</p>
                <p className="font-medium">
                  {status.whatsappBusinessName} · {status.phoneNumberDisplay}
                </p>
              </div>
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {status.tokenType === "embedded" ? "Connected via Facebook" : "Manual token"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <p className="text-xs text-muted-foreground">
                Set your webhook URL to this app's <code>/api/public/whatsapp-webhook</code> in the
                Meta App dashboard once, and every connected business routes through it.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {status?.lastError ? (
              <p className="text-sm text-status-attention">{status.lastError}</p>
            ) : null}

            {embeddedAvailable ? (
              <div>
                <Button onClick={startEmbeddedSignup} disabled={connecting}>
                  {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Connect with Facebook
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Opens a Facebook popup — pick or create a WhatsApp Business Account, we handle the
                  rest.
                </p>
              </div>
            ) : null}

            {embeddedAvailable && !showManual ? (
              <button
                type="button"
                className="text-sm text-[var(--grad-to)] underline underline-offset-4"
                onClick={() => setShowManual(true)}
              >
                Or paste a System User token instead
              </button>
            ) : null}

            {!embeddedAvailable || showManual ? (
              <div className="space-y-3 rounded-lg border p-4">
                {!embeddedAvailable ? (
                  <p className="text-sm text-muted-foreground">
                    One-click connect isn't set up on this server yet — paste your own WhatsApp
                    Business System User details instead (from Meta Business Suite → System Users).
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="waba-id">WhatsApp Business Account ID</Label>
                  <Input
                    id="waba-id"
                    value={manualWaba}
                    onChange={(e) => setManualWaba(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone-number-id">Phone number ID</Label>
                  <Input
                    id="phone-number-id"
                    value={manualPhoneId}
                    onChange={(e) => setManualPhoneId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="access-token">System user access token</Label>
                  <Input
                    id="access-token"
                    type="password"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                </div>
                <Button onClick={submitManual} disabled={connecting}>
                  {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Connect
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
