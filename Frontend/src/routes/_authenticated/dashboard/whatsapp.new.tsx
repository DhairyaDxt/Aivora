import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, useWhatsappService } from "@/hooks/useOrg";

export const Route = createFileRoute("/_authenticated/dashboard/whatsapp/new")({
  component: NewWhatsappService,
});

function NewWhatsappService() {
  const navigate = useNavigate();
  const { data: org, isLoading } = useOrg();
  const { data: existing, isLoading: loadingService } = useWhatsappService(org?.id);
  const created = useRef(false);

  useEffect(() => {
    if (isLoading || loadingService || !org || created.current) return;
    created.current = true;

    const run = async () => {
      if (existing) {
        navigate({ to: "/dashboard/whatsapp/$serviceId", params: { serviceId: existing.id } });
        return;
      }
      const { data, error } = await supabase
        .from("services")
        .insert({
          org_id: org.id,
          type: "whatsapp",
          name: `${org.name} WhatsApp assistant`,
          status: "draft",
        })
        .select()
        .single();
      if (error || !data) {
        toast.error("Could not create your WhatsApp assistant.");
        navigate({ to: "/dashboard" });
        return;
      }
      navigate({ to: "/dashboard/whatsapp/$serviceId", params: { serviceId: data.id } });
    };
    void run();
  }, [isLoading, loadingService, org, existing, navigate]);

  return (
    <div className="p-10 text-sm text-muted-foreground">Setting up your WhatsApp assistant…</div>
  );
}
