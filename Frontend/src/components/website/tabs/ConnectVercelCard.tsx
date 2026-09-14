import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getVercelStatus, connectVercelManual, disconnectVercel } from "@/lib/website.functions";
import { Triangle, Loader2, ExternalLink } from "lucide-react";

export function ConnectVercelCard({ serviceId }: { serviceId: string }) {
  const queryClient = useQueryClient();
  const getStatus = useServerFn(getVercelStatus);
  const connect = useServerFn(connectVercelManual);
  const disconnect = useServerFn(disconnectVercel);

  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["vercel-status", serviceId],
    queryFn: () => getStatus({ data: { serviceId } }),
  });
  const status = statusQuery.data;

  const handleConnect = async () => {
    if (!token.trim()) return;
    setConnecting(true);
    try {
      await connect({ data: { serviceId, accessToken: token.trim() } });
      setToken("");
      await queryClient.invalidateQueries({ queryKey: ["vercel-status", serviceId] });
      toast.success("Vercel connected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect Vercel.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnect({ data: { serviceId } });
      await queryClient.invalidateQueries({ queryKey: ["vercel-status", serviceId] });
      toast.success("Vercel disconnected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="rounded-xl border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-black text-white">
              <Triangle className="size-4" fill="white" />
            </span>
            <div>
              <h3 className="font-semibold">Vercel</h3>
              <p className="text-sm text-muted-foreground">
                Your site publishes straight to your own Vercel account.
              </p>
            </div>
          </div>
          {status?.connected ? (
            <span className="rounded-full border border-status-live/30 bg-status-live/12 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-status-live">
              Connected
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
              Not connected
            </span>
          )}
        </div>

        {status?.connected ? (
          <div className="mt-5 space-y-4 text-sm">
            {status.deploymentUrl ? (
              <a
                href={status.deploymentUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[var(--grad-to)] hover:underline"
              >
                View live site <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <p className="text-muted-foreground">
                Not published yet — use the Publish button once you're happy with your site.
              </p>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Disconnecting won't take your site down — it'll still be live on Vercel.
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
          <div className="mt-5 space-y-3">
            <Label htmlFor="vercel-token">Personal Access Token</Label>
            <Input
              id="vercel-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Vercel token"
            />
            <p className="text-xs text-muted-foreground">
              Create one at{" "}
              <a
                href="https://vercel.com/account/tokens"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                vercel.com/account/tokens
              </a>{" "}
              — no special scope needed, just a personal token.
            </p>
            <Button onClick={handleConnect} disabled={connecting || !token.trim()}>
              {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Connect
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
