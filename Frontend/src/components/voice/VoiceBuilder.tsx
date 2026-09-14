import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonaTab } from "./tabs/PersonaTab";
import { VoiceTab } from "./tabs/VoiceTab";
import { ActionsTab } from "./tabs/ActionsTab";
import { HoursTab } from "./tabs/HoursTab";
import { PhoneTab } from "./tabs/PhoneTab";
import { FlowTab } from "./tabs/FlowTab";
import { KnowledgeTab } from "./tabs/KnowledgeTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { TestCallDrawer } from "@/components/aivora/TestCallDrawer";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";
import { goLive, syncAssistant } from "@/lib/voice.functions";
import { Database } from "@/integrations/supabase/types";

export type VoiceConfig = Database["public"]["Tables"]["voice_agent_configs"]["Row"];

export function VoiceBuilder() {
  const { serviceId } = useParams({ from: "/_authenticated/dashboard/voice/$serviceId" });
  const sync = useServerFn(syncAssistant);
  const deploy = useServerFn(goLive);
  const [config, setConfig] = useState<Partial<VoiceConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);

  const loadConfig = async () => {
    const { data, error } = await supabase
      .from("voice_agent_configs")
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

  const updateConfig = (updates: Partial<VoiceConfig>) => {
    setConfig((previous) => ({ ...previous, ...updates }));
  };

  const saveAndSync = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("voice_agent_configs")
        .upsert({ ...config, service_id: serviceId });
      if (error) throw error;

      const result = await sync({ data: { serviceId } });
      updateConfig({ vapi_assistant_id: result.assistantId });
      toast.success("Receptionist saved and synced to Vapi.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save and sync the receptionist.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleGoLive = async () => {
    setSaving(true);
    try {
      await deploy({ data: { serviceId } });
      toast.success("Your receptionist is live.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to take the receptionist live.");
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
          <SectionLabel index={4}>Voice receptionist</SectionLabel>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Voice Receptionist</h1>
          <p className="text-sm text-muted-foreground">
            Configure and manage your AI receptionist.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={saveAndSync} disabled={saving}>
            {saving ? "Saving..." : "Save/Sync"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setTestDrawerOpen(true)}
            disabled={!config.vapi_assistant_id}
          >
            Test call
          </Button>
          <Button onClick={handleGoLive} disabled={saving || !config.vapi_assistant_id}>
            Go live
          </Button>
        </div>
      </div>

      <Tabs defaultValue="persona" className="relative flex flex-1 flex-col">
        <TabsList className="grid w-full grid-cols-4 gap-1 lg:grid-cols-8 lg:w-[820px]">
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="phone">Phone</TabsTrigger>
          <TabsTrigger value="flow">Flow</TabsTrigger>
        </TabsList>
        <div className="glass mt-4 flex-1 p-6 text-card-foreground">
          <TabsContent value="persona" className="m-0 h-full">
            <PersonaTab config={config} onChange={updateConfig} />
          </TabsContent>
          <TabsContent value="voice" className="m-0 h-full">
            <VoiceTab config={config} onChange={updateConfig} />
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
          <TabsContent value="phone" className="m-0 h-full">
            <PhoneTab
              serviceId={serviceId}
              config={config}
              onChange={updateConfig}
              onAssigned={() => void loadConfig()}
            />
          </TabsContent>
          <TabsContent value="flow" className="m-0 h-full">
            <FlowTab config={config} onChange={updateConfig} />
          </TabsContent>
        </div>
      </Tabs>
      <TestCallDrawer
        open={testDrawerOpen}
        onOpenChange={setTestDrawerOpen}
        serviceId={serviceId}
      />
    </div>
  );
}
