import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";
import { completeCalendlyConnect } from "@/lib/calendly.functions";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/calendly-callback")({
  component: CalendlyCallback,
});

function CalendlyCallback() {
  const { data: org } = useOrg();
  const navigate = useNavigate();
  const complete = useServerFn(completeCalendlyConnect);
  const [status, setStatus] = useState<"working" | "error">("working");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !org?.id) return;
    ran.current = true;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const savedState = sessionStorage.getItem("calendly_oauth_state");
      sessionStorage.removeItem("calendly_oauth_state");

      if (!code || !state || state !== savedState) {
        setStatus("error");
        toast.error("That Calendly connection request looks invalid. Please try connecting again.");
        return;
      }

      try {
        await complete({
          data: {
            orgId: org.id,
            code,
            redirectUri: `${window.location.origin}/dashboard/calendly-callback`,
          },
        });
        toast.success("Calendly connected.");
        navigate({ to: "/dashboard/connections" });
      } catch (error) {
        setStatus("error");
        toast.error(error instanceof Error ? error.message : "Could not connect Calendly.");
      }
    };

    void run();
  }, [org?.id, complete, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <AuroraBackground />
      <div className="glass relative flex flex-col items-center gap-3 p-8 text-center">
        {status === "working" ? (
          <>
            <Loader2 className="size-6 animate-spin text-[var(--grad-to)]" />
            <p className="text-sm text-muted-foreground">Connecting your Calendly account...</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">That didn't work.</p>
            <button
              className="text-sm text-[var(--grad-to)] underline underline-offset-4"
              onClick={() => navigate({ to: "/dashboard/connections" })}
            >
              Back to Connections
            </button>
          </>
        )}
      </div>
    </div>
  );
}
