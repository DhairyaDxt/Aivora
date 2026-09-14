import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Org = {
  id: string;
  name: string;
  slug: string;
  industry_vertical: string | null;
  country: string | null;
  timezone: string;
};

/** Current user's organization (owner role, one org per user in this build). */
export function useOrg() {
  return useQuery({
    queryKey: ["org"],
    queryFn: async (): Promise<Org | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id, organizations(id, name, slug, industry_vertical, country, timezone)")
        .eq("user_id", auth.user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.organizations as Org | null) ?? null;
    },
  });
}

export function useVoiceService(orgId: string | undefined) {
  return useQuery({
    queryKey: ["voice-service", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("org_id", orgId!)
        .eq("type", "voice")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useWhatsappService(orgId: string | undefined) {
  return useQuery({
    queryKey: ["whatsapp-service", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("org_id", orgId!)
        .eq("type", "whatsapp")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useWebsiteService(orgId: string | undefined) {
  return useQuery({
    queryKey: ["website-service", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("org_id", orgId!)
        .eq("type", "website")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
