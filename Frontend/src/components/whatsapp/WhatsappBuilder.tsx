import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonaTab } from "./tabs/PersonaTab";
import { ActionsTab } from "./tabs/ActionsTab";
import { HoursTab } from "./tabs/HoursTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { ConnectTab } from "./tabs/ConnectTab";
import { InboxTab } from "./tabs/InboxTab";
import { KnowledgeTab } from "@/components/voice/tabs/KnowledgeTab";
import { WhatsappTestDrawer } from "@/components/aivora/WhatsappTestDrawer";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";
import { goLiveWhatsapp } from "@/lib/whatsapp.functions";
import { Database } from "@/integrations/supabase/types";

export type WhatsappConfig = Database["public"]["Tables"]["whatsapp_bot_configs"]["Row"];

export function WhatsappBuilder() {
  const { serviceId } = useParams({ from: "/_authenticated/dashboard/whatsapp/$serviceId" });
  const deploy = useServerFn(goLiveWhatsapp);
  const [config, setConfig] = useState<Partial<WhatsappConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);

  const loadConfig = async () => {
    const { data, error } = await supabase
      .from("whatsapp_bot_configs")
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();
    if (error) throw error;
    setConfig(data ?? {});
  };

  useEffect(() => {
    void loadConfig()
      .catch(() => toast.error("Failed to load configuration."))
      .finally(() => setLoading(false));
  }, [serviceId]);

  const updateConfig = (updates: Partial<WhatsappConfig>) => {
    setConfig((previous) => ({ ...previous, ...updates }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_bot_configs")
        .upsert({ ...config, service_id: serviceId });
      if (error) throw error;
      toast.success("Saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleGoLive = async () => {
    setSaving(true);
    try {
      await deploy({ data: { serviceId } });
      toast.success("Your WhatsApp assistant is live.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to go live.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading configuration...</div>;

  return (
    <div className="relative mx-auto flex h-full max-w-5xl flex-col space-y-4 overflow-hidden p-8">
      <AuroraBackground />
      <div className="relative flex items-center justify-between">
        <div>
          <SectionLabel index={4}>WhatsApp assistant</SectionLabel>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">WhatsApp Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Configure and manage your AI WhatsApp assistant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="outline" onClick={() => setTestDrawerOpen(true)}>
            Simulate chat
          </Button>
          <Button
            onClick={handleGoLive}
            disabled={saving || config.connection_status !== "connected"}
          >
            Go live
          </Button>
        </div>
      </div>

      <Tabs defaultValue="persona" className="relative flex flex-1 flex-col">
        <TabsList className="grid w-full grid-cols-3 gap-1 lg:grid-cols-7 lg:w-[820px]">
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="connect">Connect</TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
        </TabsList>
        <div className="glass mt-4 flex-1 p-6 text-card-foreground">
          <TabsContent value="persona" className="m-0 h-full">
            <PersonaTab config={config} onChange={updateConfig} />
          </TabsContent>
          <TabsContent value="knowledge" className="m-0 h-full">
            <KnowledgeTab />
          </TabsContent>
          <TabsContent value="actions" className="m-0 h-full">
            <ActionsTab config={config} onChange={updateConfig} />
          </TabsContent>
          <TabsContent value="advanced" className="m-0 h-full">
            <AdvancedTab config={config} onChange={updateConfig} />
          </TabsContent>
          <TabsContent value="hours" className="m-0 h-full">
            <HoursTab config={config} onChange={updateConfig} />
          </TabsContent>
          <TabsContent value="connect" className="m-0 h-full">
            <ConnectTab serviceId={serviceId} onConnected={() => void loadConfig()} />
          </TabsContent>
          <TabsContent value="inbox" className="m-0 h-full">
            <InboxTab serviceId={serviceId} />
          </TabsContent>
        </div>
      </Tabs>
      <WhatsappTestDrawer
        open={testDrawerOpen}
        onOpenChange={setTestDrawerOpen}
        serviceId={serviceId}
      />
    </div>
  );
}
