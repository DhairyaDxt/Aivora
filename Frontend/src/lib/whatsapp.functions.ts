import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireServiceAccess(supabase: SupabaseClient, serviceId: string) {
  const { data: service } = await supabase
    .from("services")
    .select("id, org_id, name")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) throw new Error("That WhatsApp assistant could not be found.");
  return service;
}

/** Public config for the Facebook JS SDK - safe to expose unauthenticated,
 * same as getVoicePublicKey. `available:false` tells the Connect tab to show
 * only the manual-token form because the platform's Meta App isn't set up. */
export const getWhatsappEmbeddedSignupConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const appId = process.env["VITE_META_APP_ID"] ?? null;
    const configId = process.env["VITE_META_CONFIG_ID"] ?? null;
    return { appId, configId, available: Boolean(appId && configId) };
  },
);

export type WhatsappStatus = {
  connected: boolean;
  connectionStatus: string;
  tokenType: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  phoneNumberDisplay: string | null;
  whatsappBusinessName: string | null;
  lastError: string | null;
  connectedAt: string | null;
};

export const getWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }): Promise<WhatsappStatus> => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { data: row } = await context.supabase
      .from("whatsapp_bot_configs")
      .select(
        "connection_status, token_type, waba_id, phone_number_id, phone_number_display, whatsapp_business_name, last_error, connected_at",
      )
      .eq("service_id", data.serviceId)
      .maybeSingle();

    return {
      connected: row?.connection_status === "connected",
      connectionStatus: row?.connection_status ?? "not_connected",
      tokenType: row?.token_type ?? null,
      wabaId: row?.waba_id ?? null,
      phoneNumberId: row?.phone_number_id ?? null,
      phoneNumberDisplay: row?.phone_number_display ?? null,
      whatsappBusinessName: row?.whatsapp_business_name ?? null,
      lastError: row?.last_error ?? null,
      connectedAt: row?.connected_at ?? null,
    };
  });

export const completeMetaEmbeddedSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { serviceId: string; code: string; wabaId: string; phoneNumberId: string }) => data,
  )
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { exchangeMetaEmbeddedSignupCode, subscribeAppToWaba, getPhoneNumberDisplayInfo } =
      await import("./whatsapp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const { accessToken, expiresInSeconds } = await exchangeMetaEmbeddedSignupCode(data.code);
      const [info] = await Promise.all([
        getPhoneNumberDisplayInfo(accessToken, data.phoneNumberId),
        subscribeAppToWaba(accessToken, data.wabaId).catch((err) => {
          console.error("subscribeAppToWaba failed", err);
        }),
      ]);

      const secretName = `whatsapp_access_${data.serviceId}`;
      const { error: vaultError } = await supabaseAdmin.rpc("store_whatsapp_secret", {
        p_name: secretName,
        p_secret: accessToken,
      });
      if (vaultError) throw new Error(vaultError.message);

      const { error } = await supabaseAdmin.from("whatsapp_bot_configs").upsert(
        {
          service_id: data.serviceId,
          waba_id: data.wabaId,
          phone_number_id: data.phoneNumberId,
          phone_number_display: info.display_phone_number,
          whatsapp_business_name: info.verified_name,
          access_token_secret_ref: secretName,
          token_type: "embedded",
          token_expires_at: expiresInSeconds
            ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
            : null,
          connection_status: "connected",
          last_error: null,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "service_id" },
      );
      if (error) throw new Error(error.message);

      return { ok: true as const, phoneNumberDisplay: info.display_phone_number };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not connect WhatsApp.";
      await supabaseAdmin
        .from("whatsapp_bot_configs")
        .upsert(
          { service_id: data.serviceId, connection_status: "error", last_error: message },
          { onConflict: "service_id" },
        );
      throw new Error(message);
    }
  });

export const connectWhatsappManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { serviceId: string; wabaId: string; phoneNumberId: string; accessToken: string }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { getPhoneNumberDisplayInfo, subscribeAppToWaba } = await import("./whatsapp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      // Validate the pasted token actually works before saving it.
      const info = await getPhoneNumberDisplayInfo(data.accessToken, data.phoneNumberId);
      await subscribeAppToWaba(data.accessToken, data.wabaId).catch((err) => {
        console.error("subscribeAppToWaba failed", err);
      });

      const secretName = `whatsapp_access_${data.serviceId}`;
      const { error: vaultError } = await supabaseAdmin.rpc("store_whatsapp_secret", {
        p_name: secretName,
        p_secret: data.accessToken,
      });
      if (vaultError) throw new Error(vaultError.message);

      const { error } = await supabaseAdmin.from("whatsapp_bot_configs").upsert(
        {
          service_id: data.serviceId,
          waba_id: data.wabaId,
          phone_number_id: data.phoneNumberId,
          phone_number_display: info.display_phone_number,
          whatsapp_business_name: info.verified_name,
          access_token_secret_ref: secretName,
          token_type: "manual",
          token_expires_at: null,
          connection_status: "connected",
          last_error: null,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "service_id" },
      );
      if (error) throw new Error(error.message);

      return { ok: true as const, phoneNumberDisplay: info.display_phone_number };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not connect that WhatsApp Business number. Double-check the IDs and token.";
      throw new Error(message);
    }
  });

export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("whatsapp_bot_configs")
      .select("access_token_secret_ref")
      .eq("service_id", data.serviceId)
      .maybeSingle();

    if (row?.access_token_secret_ref) {
      await supabaseAdmin.rpc("delete_whatsapp_secret", { p_name: row.access_token_secret_ref });
    }

    await supabaseAdmin
      .from("whatsapp_bot_configs")
      .update({
        waba_id: null,
        phone_number_id: null,
        phone_number_display: null,
        whatsapp_business_name: null,
        access_token_secret_ref: null,
        token_type: null,
        token_expires_at: null,
        connection_status: "not_connected",
        last_error: null,
        connected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("service_id", data.serviceId);

    await context.supabase.from("services").update({ status: "draft" }).eq("id", data.serviceId);
    return { ok: true as const };
  });

export const goLiveWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { data: config } = await context.supabase
      .from("whatsapp_bot_configs")
      .select("connection_status")
      .eq("service_id", data.serviceId)
      .maybeSingle();
    if (config?.connection_status !== "connected") {
      throw new Error("Connect your WhatsApp Business account before going live.");
    }

    const { error } = await context.supabase
      .from("services")
      .update({ status: "live", deployed_at: new Date().toISOString() })
      .eq("id", data.serviceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type SandboxTurn = { role: "customer" | "ai"; text: string };

/** Sandbox "Simulate chat" - runs the exact same reply loop as the real
 * webhook, against an is_sandbox conversation, without ever touching the
 * real WhatsApp API. Preview mode per the TRD. */
export const sendWhatsappTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string; message: string }) => data)
  .handler(async ({ data, context }): Promise<{ escalated: boolean; messages: SandboxTurn[] }> => {
    const service = await requireServiceAccess(context.supabase, data.serviceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getOrCreateWhatsappConversation, generateWhatsappReply } =
      await import("./whatsapp.server");

    const [{ data: config }, { data: org }, { data: business }] = await Promise.all([
      supabaseAdmin
        .from("whatsapp_bot_configs")
        .select("*")
        .eq("service_id", data.serviceId)
        .maybeSingle(),
      supabaseAdmin
        .from("organizations")
        .select("name, industry_vertical, timezone, country")
        .eq("id", service.org_id!)
        .maybeSingle(),
      supabaseAdmin
        .from("business_profiles")
        .select("display_name, legal_name, description, address, business_hours, languages")
        .eq("org_id", service.org_id!)
        .maybeSingle(),
    ]);
    if (!config) throw new Error("Set up your persona first.");

    const conversation = await getOrCreateWhatsappConversation(supabaseAdmin, {
      orgId: service.org_id!,
      serviceId: service.id,
      customerIdentifier: "sandbox tester",
      isSandbox: true,
    });

    if (conversation.isNew && config.welcome_message) {
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversation.id,
        sender: "ai",
        content: config.welcome_message,
      });
    }

    await supabaseAdmin.from("messages").insert({
      conversation_id: conversation.id,
      sender: "customer",
      content: data.message,
    });

    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("sender, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(20);

    const chatHistory = (history ?? []).map((m) => ({
      role: (m.sender === "customer" ? "user" : "assistant") as "user" | "assistant",
      content: m.content ?? "",
    }));

    const { replyText, escalated } = await generateWhatsappReply(
      supabaseAdmin,
      {
        orgId: service.org_id!,
        serviceId: service.id,
        conversationId: conversation.id,
        timezone: org?.timezone ?? "UTC",
        business: business as never,
        org: org as never,
        config: config as never,
      },
      chatHistory,
    );

    await supabaseAdmin.from("messages").insert({
      conversation_id: conversation.id,
      sender: "ai",
      content: replyText,
    });
    await supabaseAdmin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    const { data: finalHistory } = await supabaseAdmin
      .from("messages")
      .select("sender, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    return {
      escalated,
      messages: (finalHistory ?? []).map((m) => ({
        role: (m.sender === "customer" ? "customer" : "ai") as SandboxTurn["role"],
        text: m.content ?? "",
      })),
    };
  });

export type InboxConversation = {
  id: string;
  customerIdentifier: string | null;
  status: string | null;
  lastMessageAt: string | null;
  lastMessage: string | null;
};

export const listWhatsappConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }): Promise<InboxConversation[]> => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { data: rows, error } = await context.supabase
      .from("conversations")
      .select("id, customer_identifier, status, last_message_at, messages(content, created_at)")
      .eq("service_id", data.serviceId)
      .eq("channel", "whatsapp")
      .eq("is_sandbox", false)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const msgs = (row.messages ?? []) as Array<{
        content: string | null;
        created_at: string | null;
      }>;
      const last = [...msgs]
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
        .at(-1);
      return {
        id: row.id,
        customerIdentifier: row.customer_identifier,
        status: row.status,
        lastMessageAt: row.last_message_at,
        lastMessage: last?.content ?? null,
      };
    });
  });

export type InboxMessage = {
  id: string;
  sender: string;
  content: string | null;
  createdAt: string | null;
};

export const listWhatsappMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string }) => data)
  .handler(async ({ data, context }): Promise<InboxMessage[]> => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, sender, content, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      sender: r.sender,
      content: r.content,
      createdAt: r.created_at,
    }));
  });

/** Human takeover: the owner replies directly from the Inbox tab, sent for
 * real via the Cloud API, and pulls the conversation off `escalated`. */
export const sendWhatsappOwnerReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string; message: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: conversation } = await context.supabase
      .from("conversations")
      .select("id, service_id, customer_identifier, is_sandbox")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conversation || !conversation.service_id || !conversation.customer_identifier) {
      throw new Error("That conversation could not be found.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getValidWhatsappAccessToken, sendWhatsappTextMessage } =
      await import("./whatsapp.server");

    const { data: config } = await context.supabase
      .from("whatsapp_bot_configs")
      .select("phone_number_id, access_token_secret_ref, connection_status")
      .eq("service_id", conversation.service_id)
      .maybeSingle();
    if (!config?.phone_number_id) throw new Error("WhatsApp isn't connected for this assistant.");

    if (!conversation.is_sandbox) {
      const accessToken = await getValidWhatsappAccessToken(supabaseAdmin, config);
      if (!accessToken) throw new Error("WhatsApp isn't connected for this assistant.");
      await sendWhatsappTextMessage(
        accessToken,
        config.phone_number_id,
        conversation.customer_identifier,
        data.message,
      );
    }

    await context.supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender: "agent",
      content: data.message,
    });
    await context.supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "active",
        resolution_type: "human_handoff",
      })
      .eq("id", conversation.id);

    return { ok: true as const };
  });

/** Hands a conversation back to the AI without sending anything - just
 * clears the escalated state so the webhook resumes auto-replying. */
export const handBackToAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ status: "active" })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
