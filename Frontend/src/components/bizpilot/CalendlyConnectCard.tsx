import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCalendlyStatus,
  getCalendlyConnectUrl,
  listCalendlyEventTypesForOrg,
  setCalendlyEventType,
  disconnectCalendly,
} from "@/lib/calendly.functions";
import { Calendar, ExternalLink, Loader2 } from "lucide-react";

export function CalendlyConnectCard({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const getStatus = useServerFn(getCalendlyStatus);
  const getConnectUrl = useServerFn(getCalendlyConnectUrl);
  const listEventTypes = useServerFn(listCalendlyEventTypesForOrg);
  const chooseEventType = useServerFn(setCalendlyEventType);
  const disconnect = useServerFn(disconnectCalendly);

  const [connecting, setConnecting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [savingEventType, setSavingEventType] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["calendly-status", orgId],
    queryFn: () => getStatus({ data: { orgId } }),
  });

  const eventTypesQuery = useQuery({
    queryKey: ["calendly-event-types", orgId],
    queryFn: () => listEventTypes({ data: { orgId } }),
    enabled: statusQuery.data?.connected === true && showPicker,
  });

  const status = statusQuery.data;
  const needsEventType = status?.connected && !status.eventTypeUri;

  const connect = async () => {
    setConnecting(true);
    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem("calendly_oauth_state", state);
      const redirectUri = `${window.location.origin}/dashboard/calendly-callback`;
      const { url } = await getConnectUrl({ data: { orgId, redirectUri, state } });
      window.location.href = url;
    } catch (error) {
      setConnecting(false);
      toast.error(
        error instanceof Error ? error.message : "Could not start the Calendly connection.",
      );
    }
  };

  const pickEventType = async (uri: string) => {
    const option = eventTypesQuery.data?.find((e) => e.uri === uri);
    if (!option) return;
    setSavingEventType(true);
    try {
      await chooseEventType({
        data: {
          orgId,
          eventTypeUri: option.uri,
          eventTypeName: option.name,
          durationMinutes: option.durationMinutes,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["calendly-status", orgId] });
      setShowPicker(false);
      toast.success(`Bookings will use "${option.name}".`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that event type.");
    } finally {
      setSavingEventType(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnect({ data: { orgId } });
      await queryClient.invalidateQueries({ queryKey: ["calendly-status", orgId] });
      toast.success("Calendly disconnected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect Calendly.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="glass hover-lift p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--grad-from)] to-[var(--grad-to)] text-white">
            <Calendar className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold">Calendly</h3>
            <p className="text-sm text-muted-foreground">
              Lets the receptionist check real availability and book appointments on the phone.
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-muted-foreground">Signed in as</p>
              <p className="font-medium">
                {status.ownerName} · {status.ownerEmail}
              </p>
            </div>
            {status.schedulingUrl ? (
              <a
                href={status.schedulingUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[var(--grad-to)] hover:underline"
              >
                Open Calendly <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>

          <div>
            <p className="text-muted-foreground">Booking event type</p>
            {needsEventType && !showPicker ? (
              <p className="mt-1 text-status-testing">
                No event type selected yet — the receptionist can't book until you choose one.
              </p>
            ) : null}
            {!showPicker ? (
              <div className="mt-1 flex items-center gap-3">
                <p className="font-medium">
                  {status.eventTypeName ?? "None selected"}
                  {status.eventTypeDurationMinutes
                    ? ` · ${status.eventTypeDurationMinutes} min`
                    : ""}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setShowPicker(true)}
                >
                  {status.eventTypeUri ? "Change" : "Choose"}
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                {eventTypesQuery.isLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Select onValueChange={pickEventType} disabled={savingEventType}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Pick an event type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(eventTypesQuery.data ?? []).map((et) => (
                        <SelectItem key={et.uri} value={et.uri}>
                          {et.name} · {et.durationMinutes} min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowPicker(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
            <p className="text-xs text-muted-foreground">
              Booking requires a paid Calendly plan on the connected account.
            </p>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <Button onClick={connect} disabled={connecting}>
            {connecting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Connect Calendly
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Requires a paid Calendly plan (Standard or higher) on the account you connect.
          </p>
        </div>
      )}
    </div>
  );
}
