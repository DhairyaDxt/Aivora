import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOrgAccess(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
) {
  const { data } = await supabase.from("organizations").select("id").eq("id", orgId).maybeSingle();
  if (!data) throw new Error("You do not have access to this business.");
}

export type CalendlyStatus = {
  connected: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  schedulingUrl: string | null;
  eventTypeUri: string | null;
  eventTypeName: string | null;
  eventTypeDurationMinutes: number | null;
};

export const getCalendlyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ data, context }): Promise<CalendlyStatus> => {
    const { data: row } = await context.supabase
      .from("calendly_connections")
      .select(
        "owner_name, owner_email, scheduling_url, event_type_uri, event_type_name, event_type_duration_minutes",
      )
      .eq("org_id", data.orgId)
      .maybeSingle();

    if (!row) {
      return {
        connected: false,
        ownerName: null,
        ownerEmail: null,
        schedulingUrl: null,
        eventTypeUri: null,
        eventTypeName: null,
        eventTypeDurationMinutes: null,
      };
    }
    return {
      connected: true,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      schedulingUrl: row.scheduling_url,
      eventTypeUri: row.event_type_uri,
      eventTypeName: row.event_type_name,
      eventTypeDurationMinutes: row.event_type_duration_minutes,
    };
  });

export const getCalendlyConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; redirectUri: string; state: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOrgAccess(context.supabase, data.orgId);
    const { calendlyAuthorizeUrl } = await import("./calendly.server");
    return { url: calendlyAuthorizeUrl(data.redirectUri, data.state) };
  });

export type CalendlyEventTypeOption = { uri: string; name: string; durationMinutes: number };

export const completeCalendlyConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; code: string; redirectUri: string }) => data)
  .handler(async ({ data, context }): Promise<{ eventTypes: CalendlyEventTypeOption[] }> => {
    await assertOrgAccess(context.supabase, data.orgId);
    const { exchangeCalendlyCode, getCalendlyCurrentUser, listCalendlyEventTypes } =
      await import("./calendly.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tokens = await exchangeCalendlyCode(data.code, data.redirectUri);
    const me = await getCalendlyCurrentUser(tokens.access_token);
    const eventTypes = await listCalendlyEventTypes(tokens.access_token, me.resource.uri);

    const accessSecretName = `calendly_access_${data.orgId}`;
    const refreshSecretName = `calendly_refresh_${data.orgId}`;
    await Promise.all([
      supabaseAdmin.rpc("store_calendly_secret", {
        p_name: accessSecretName,
        p_secret: tokens.access_token,
      }),
      supabaseAdmin.rpc("store_calendly_secret", {
        p_name: refreshSecretName,
        p_secret: tokens.refresh_token,
      }),
    ]);

    const single = eventTypes.length === 1 ? eventTypes[0] : null;

    const { error } = await supabaseAdmin.from("calendly_connections").upsert(
      {
        org_id: data.orgId,
        calendly_user_uri: me.resource.uri,
        organization_uri: me.resource.current_organization,
        scheduling_url: me.resource.scheduling_url,
        owner_name: me.resource.name,
        owner_email: me.resource.email,
        timezone: me.resource.timezone,
        event_type_uri: single?.uri ?? null,
        event_type_name: single?.name ?? null,
        event_type_duration_minutes: single?.duration ?? null,
        access_token_secret_ref: accessSecretName,
        refresh_token_secret_ref: refreshSecretName,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: "connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );
    if (error) throw new Error(error.message);

    return {
      eventTypes: eventTypes.map((e) => ({
        uri: e.uri,
        name: e.name,
        durationMinutes: e.duration,
      })),
    };
  });

export const listCalendlyEventTypesForOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ data, context }): Promise<CalendlyEventTypeOption[]> => {
    await assertOrgAccess(context.supabase, data.orgId);
    const { getValidCalendlyAccessToken, listCalendlyEventTypes } =
      await import("./calendly.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const access = await getValidCalendlyAccessToken(supabaseAdmin, data.orgId);
    if (!access) throw new Error("Connect Calendly first.");
    const eventTypes = await listCalendlyEventTypes(
      access.accessToken,
      access.connection.calendly_user_uri,
    );
    return eventTypes.map((e) => ({ uri: e.uri, name: e.name, durationMinutes: e.duration }));
  });

export const setCalendlyEventType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orgId: string;
      eventTypeUri: string;
      eventTypeName: string;
      durationMinutes: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertOrgAccess(context.supabase, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("calendly_connections")
      .update({
        event_type_uri: data.eventTypeUri,
        event_type_name: data.eventTypeName,
        event_type_duration_minutes: data.durationMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectCalendly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOrgAccess(context.supabase, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("calendly_connections")
      .select("access_token_secret_ref, refresh_token_secret_ref")
      .eq("org_id", data.orgId)
      .maybeSingle();

    if (row) {
      await Promise.all([
        supabaseAdmin.rpc("delete_calendly_secret", { p_name: row.access_token_secret_ref }),
        supabaseAdmin.rpc("delete_calendly_secret", { p_name: row.refresh_token_secret_ref }),
      ]);
    }
    await supabaseAdmin.from("calendly_connections").delete().eq("org_id", data.orgId);
    return { ok: true };
  });
