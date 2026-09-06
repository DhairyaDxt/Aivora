import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, useVoiceService } from "@/hooks/useOrg";

export const Route = createFileRoute("/_authenticated/dashboard/voice/new")({
  component: NewVoiceService,
});

function NewVoiceService() {
  const navigate = useNavigate();
  const { data: org, isLoading } = useOrg();
  const { data: existing, isLoading: loadingService } = useVoiceService(org?.id);
  const created = useRef(false);

  useEffect(() => {
    if (isLoading || loadingService || !org || created.current) return;
    created.current = true;

    const run = async () => {
      if (existing) {
        navigate({ to: "/dashboard/voice/$serviceId", params: { serviceId: existing.id } });
        return;
      }
      const { data, error } = await supabase
        .from("services")
        .insert({
          org_id: org.id,
          type: "voice",
          name: `${org.name} receptionist`,
          status: "draft",
        })
        .select()
        .single();
      if (error || !data) {
        toast.error("Could not create your receptionist.");
        navigate({ to: "/dashboard" });
        return;
      }
      navigate({ to: "/dashboard/voice/$serviceId", params: { serviceId: data.id } });
    };
    void run();
  }, [isLoading, loadingService, org, existing, navigate]);

  return <div className="p-10 text-sm text-muted-foreground">Setting up your receptionist…</div>;
}
