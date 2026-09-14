import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = Record<string, unknown>;

function webhookUrl(): string | undefined {
  // Vapi's cloud servers can't reach a bare "localhost" origin, so tool
  // calls (check_availability, book_appointment, etc.) would just go
  // unanswered in local dev. Set PUBLIC_APP_URL to a tunnel (e.g. ngrok)
  // pointed at this dev server to test them for real.
  const override = process.env["PUBLIC_APP_URL"];
  if (override) return `${override.replace(/\/$/, "")}/api/public/vapi-webhook`;

  try {
    const req = getRequest();
    const origin = new URL(req.url).origin;
    if (origin.startsWith("http://localhost")) return undefined;
    return `${origin}/api/public/vapi-webhook`;
  } catch {
    return undefined;
  }
}

export const getVoicePublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPI_PUBLIC_KEY"] ?? null };
});

/** Builds the prompt, creates or updates the voice assistant, links the number. */
export const syncAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { buildSystemPrompt, buildAssistantPayload, vapiFetch } = await import("./voice.server");

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, org_id, status")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (serviceError || !service) throw new Error("That receptionist could not be found.");

    // Fetch orchestration config (app_config is a singleton table added by migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: appConfig } = (await (supabase as any)
      .from("app_config")
      .select("orchestration_url, orchestration_enabled")
      .eq("id", true)
      .maybeSingle()) as {
      data: { orchestration_url: string | null; orchestration_enabled: boolean | null } | null;
    };

    const [
      { data: config },
      { data: org },
      { data: business },
      { data: knowledge },
      { data: numbers },
    ] = await Promise.all([
      supabase.from("voice_agent_configs").select("*").eq("service_id", service.id).maybeSingle(),
      supabase
        .from("organizations")
        .select("name, industry_vertical, timezone, country")
        .eq("id", service.org_id!)
        .maybeSingle(),
      supabase
        .from("business_profiles")
        .select("display_name, legal_name, description, address, business_hours, languages")
        .eq("org_id", service.org_id!)
        .maybeSingle(),
      supabase
        .from("knowledge_base_entries")
        .select("type, title, content")
        .eq("org_id", service.org_id!)
        .limit(100),
      supabase
        .from("phone_numbers")
        .select("id, provider, number, vapi_number_id")
        .eq("assigned_service_id", service.id)
        .eq("status", "active"),
    ]);

    if (!config) throw new Error("Save the persona and script first.");

    const prompt = buildSystemPrompt({
      business: business as never,
      org: org as never,
      config: config as never,
      knowledge: (knowledge ?? []) as never,
    });

    // Prepare orchestration headers if enabled
    const orchestrationHeaders =
      appConfig?.orchestration_enabled && appConfig?.orchestration_url
        ? {
            Authorization: `Bearer ${process.env["ORCHESTRATION_SHARED_SECRET"]}`,
            "Content-Type": "application/json",
          }
        : null;

    // Prepare config with orchestration overrides
    const assistantConfig = {
      ...config,
      custom_llm_url:
        appConfig?.orchestration_enabled && appConfig?.orchestration_url
          ? appConfig.orchestration_url
          : (config.custom_llm_url ?? null),
      custom_llm_headers: orchestrationHeaders,
    } as typeof config & {
      custom_llm_url: string | null;
      custom_llm_headers: Record<string, string> | null;
    };

    const payload = buildAssistantPayload({
      prompt,
      config: assistantConfig as never,
      name: service.name ?? "Voice receptionist",
      serverUrl: webhookUrl(),
      metadata: {
        org_id: service.org_id!,
        service_id: service.id,
      },
    });

    try {
      let assistantId = config.vapi_assistant_id;
      if (assistantId) {
        await vapiFetch(`/assistant/${assistantId}`, { method: "PATCH", body: payload });
      } else {
        const created = await vapiFetch<{ id: string }>("/assistant", {
          method: "POST",
          body: payload,
        });
        assistantId = created.id;
      }

      const assigned = (numbers ?? [])[0];
      if (assigned?.vapi_number_id) {
        await vapiFetch(`/phone-number/${assigned.vapi_number_id}`, {
          method: "PATCH",
          body: { assistantId },
        });
      }

      await supabase
        .from("voice_agent_configs")
        .update({
          vapi_assistant_id: assistantId,
          vapi_phone_number_id: assigned?.vapi_number_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("service_id", service.id);

      if (service.status === "needs_attention") {
        await supabase
          .from("services")
          .update({ status: assigned ? "testing" : "draft" })
          .eq("id", service.id);
      }

      return { assistantId, ok: true as const };
    } catch (error) {
      await supabase.from("services").update({ status: "needs_attention" }).eq("id", service.id);
      throw error;
    }
  });

export const claimFreeNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; serviceId: string; areaCode: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { vapiFetch, FREE_NUMBER_LIMIT } = await import("./voice.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!/^\d{3}$/.test(data.areaCode)) {
      throw new Error("Enter a valid 3-digit area code.");
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (!membership) throw new Error("You do not have access to this business.");

    const { count } = await supabaseAdmin
      .from("phone_numbers")
      .select("id", { count: "exact", head: true })
      .eq("provider", "vapi_free")
      .eq("status", "active");

    if ((count ?? 0) >= FREE_NUMBER_LIMIT) {
      throw new Error("Free numbers claimed — buy a number instead.");
    }

    const created = await vapiFetch<{ id: string; number: string }>("/phone-number", {
      method: "POST",
      body: {
        provider: "vapi",
        name: "Aivora free trial number",
        numberDesiredAreaCode: data.areaCode,
      },
    });

    const { data: row, error } = await supabase
      .from("phone_numbers")
      .insert({
        org_id: data.orgId,
        provider: "vapi_free",
        vapi_number_id: created.id,
        number: created.number,
        country: "US",
        monthly_cost_cents: 0,
        per_minute_cost_cents: 0,
        assigned_service_id: data.serviceId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return row;
  });

export const searchNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; country: string; areaCode?: string }) => data)
  .handler(async ({ data }) => {
    const { twilioMasterCreds, twilioFetch, twilioUrls } = await import("./voice.server");
    const creds = twilioMasterCreds();
    const country = data.country.toUpperCase();

    const [available, numberPricing, voicePricing] = await Promise.all([
      twilioFetch<{ available_phone_numbers: Array<Json> }>(
        twilioUrls.availableLocal(creds.sid, country, data.areaCode),
        creds,
      ),
      twilioFetch<Json>(twilioUrls.numberPricing(country), creds).catch(() => null),
      twilioFetch<Json>(twilioUrls.voicePricing(country), creds).catch(() => null),
    ]);

    const localPrice = (numberPricing?.["phone_number_prices"] as Array<Json> | undefined)?.find(
      (p) => p["number_type"] === "local",
    );
    const monthly = Number(localPrice?.["current_price"] ?? 1.15);
    const inbound = (voicePricing?.["inbound_call_prices"] as Array<Json> | undefined)?.[0];
    const perMinute = Number(
      ((inbound?.["number_type_prices"] as Array<Json> | undefined)?.[0]?.[
        "current_price"
      ] as string) ?? 0.0085,
    );

    return (available.available_phone_numbers ?? []).map((n) => ({
      number: String(n["phone_number"]),
      friendly: String(n["friendly_name"]),
      locality: (n["locality"] as string) ?? "",
      region: (n["region"] as string) ?? "",
      monthlyCostCents: Math.round(monthly * 100),
      perMinuteCostCents: Math.round(perMinute * 100 * 100) / 100,
    }));
  });

export const buyNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orgId: string;
      serviceId: string;
      phoneNumber: string;
      monthlyCostCents?: number;
      perMinuteCostCents?: number;
      country?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { twilioMasterCreds, twilioFetch, twilioUrls, vapiFetch } =
      await import("./voice.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", data.orgId)
      .maybeSingle();
    if (!org) throw new Error("You do not have access to this business.");

    const master = twilioMasterCreds();

    try {
      let { data: sub } = await supabaseAdmin
        .from("twilio_subaccounts")
        .select("*")
        .eq("org_id", data.orgId)
        .maybeSingle();

      let subToken: string | null = null;

      if (!sub) {
        const created = await twilioFetch<{ sid: string; auth_token: string }>(
          twilioUrls.accounts(),
          master,
          {
            method: "POST",
            form: { FriendlyName: `Aivora ${org.name} ${data.orgId.slice(0, 8)}` },
          },
        );
        subToken = created.auth_token;
        const secretName = `twilio_subaccount_${data.orgId}`;
        const { error: vaultError } = await supabaseAdmin.rpc("store_twilio_subaccount_secret", {
          p_name: secretName,
          p_secret: created.auth_token,
        });
        if (vaultError) throw new Error(vaultError.message);
        const { data: inserted, error: subError } = await supabaseAdmin
          .from("twilio_subaccounts")
          .insert({
            org_id: data.orgId,
            subaccount_sid: created.sid,
            auth_token_secret_ref: secretName,
          })
          .select()
          .single();
        if (subError) throw new Error(subError.message);
        sub = inserted;
      }

      if (!subToken) {
        // Sub-accounts inherit master credentials for API access, so the master
        // token can act on the sub-account when the stored one is not in memory.
        subToken = master.token;
      }

      const purchased = await twilioFetch<{ sid: string; phone_number: string }>(
        twilioUrls.incoming(sub!.subaccount_sid),
        { sid: sub!.subaccount_sid, token: subToken },
        { method: "POST", form: { PhoneNumber: data.phoneNumber } },
      );

      const imported = await vapiFetch<{ id: string }>("/phone-number", {
        method: "POST",
        body: {
          provider: "twilio",
          number: purchased.phone_number,
          twilioAccountSid: sub!.subaccount_sid,
          twilioAuthToken: subToken,
        },
      });

      const { data: row, error } = await supabase
        .from("phone_numbers")
        .insert({
          org_id: data.orgId,
          provider: "twilio",
          twilio_sid: purchased.sid,
          vapi_number_id: imported.id,
          number: purchased.phone_number,
          country: data.country ?? "US",
          monthly_cost_cents: data.monthlyCostCents ?? null,
          per_minute_cost_cents: data.perMinuteCostCents ?? null,
          assigned_service_id: data.serviceId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      return row;
    } catch (error) {
      await supabase
        .from("services")
        .update({ status: "needs_attention" })
        .eq("id", data.serviceId);
      throw error;
    }
  });

export const releaseNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { phoneNumberId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { vapiFetch } = await import("./voice.server");

    const { data: row } = await supabase
      .from("phone_numbers")
      .select("*")
      .eq("id", data.phoneNumberId)
      .maybeSingle();
    if (!row) throw new Error("That number could not be found.");

    if (row.vapi_number_id) {
      await vapiFetch(`/phone-number/${row.vapi_number_id}`, { method: "DELETE" }).catch(
        () => null,
      );
    }

    await supabase
      .from("phone_numbers")
      .update({ status: "released", assigned_service_id: null })
      .eq("id", row.id);

    if (row.assigned_service_id) {
      await supabase.from("services").update({ status: "draft" }).eq("id", row.assigned_service_id);
    }
    return { ok: true as const };
  });

export const startTestCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string; mode: "web" | "phone"; toNumber?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { vapiFetch } = await import("./voice.server");

    const { data: service } = await supabase
      .from("services")
      .select("id, org_id, name")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (!service) throw new Error("That receptionist could not be found.");

    const { data: config } = await supabase
      .from("voice_agent_configs")
      .select("vapi_assistant_id, vapi_phone_number_id")
      .eq("service_id", service.id)
      .maybeSingle();
    if (!config?.vapi_assistant_id)
      throw new Error("Save your receptionist first so it can be tested.");

    await supabase
      .from("services")
      .update({ preview_opened_at: new Date().toISOString() })
      .eq("id", service.id);

    const { data: conversation } = await supabase
      .from("conversations")
      .insert({
        org_id: service.org_id,
        service_id: service.id,
        channel: "voice",
        customer_identifier: data.mode === "phone" ? (data.toNumber ?? null) : "browser test",
        is_sandbox: true,
      })
      .select()
      .single();

    if (data.mode === "web") {
      return {
        mode: "web" as const,
        assistantId: config.vapi_assistant_id,
        conversationId: conversation?.id ?? null,
      };
    }

    if (!data.toNumber) throw new Error("Enter the phone number to call.");
    if (!config.vapi_phone_number_id) {
      throw new Error("Add a phone number to this receptionist before calling out.");
    }

    const call = await vapiFetch<{ id: string }>("/call", {
      method: "POST",
      body: {
        assistantId: config.vapi_assistant_id,
        phoneNumberId: config.vapi_phone_number_id,
        customer: { number: data.toNumber },
      },
    });

    if (conversation) {
      await supabase.from("call_logs").insert({
        conversation_id: conversation.id,
        vapi_call_id: call.id,
      });
    }

    return { mode: "phone" as const, callId: call.id, conversationId: conversation?.id ?? null };
  });

/**
 * Executes a receptionist tool call (check_availability, book_appointment,
 * take_message, transfer_call) for a browser Test Call. Vapi's cloud can't
 * reach a bare "localhost" server URL, so during local dev the assistant is
 * synced as a client-side tool (see buildAssistantPayload's clientMessages)
 * and TestCallDrawer calls this authenticated endpoint directly instead -
 * same origin, so it works without any public tunnel.
 */
export const runTestCallTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      serviceId: string;
      conversationId: string;
      name: string;
      arguments: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: service } = await supabase
      .from("services")
      .select("id, org_id, organizations(timezone)")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (!service) throw new Error("That receptionist could not be found.");

    const { data: config } = await supabase
      .from("voice_agent_configs")
      .select("escalation_number")
      .eq("service_id", service.id)
      .maybeSingle();

    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("service_id", service.id)
      .maybeSingle();
    if (!conversation) throw new Error("That test call could not be found.");

    const org = service.organizations as { timezone: string } | { timezone: string }[] | null;
    const timezone = (Array.isArray(org) ? org[0]?.timezone : org?.timezone) ?? "UTC";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runVoiceTool } = await import("./voiceTools.server");

    return {
      result: await runVoiceTool(supabaseAdmin, data.name, data.arguments, {
        conversationId: conversation.id,
        escalationNumber: config?.escalation_number ?? null,
        orgId: service.org_id,
        timezone,
      }),
    };
  });

export const goLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { vapiFetch } = await import("./voice.server");

    const { data: config } = await supabase
      .from("voice_agent_configs")
      .select("vapi_assistant_id, vapi_phone_number_id")
      .eq("service_id", data.serviceId)
      .maybeSingle();
    if (!config?.vapi_assistant_id || !config.vapi_phone_number_id) {
      throw new Error("Add a phone number and test your receptionist before going live.");
    }

    await vapiFetch(`/phone-number/${config.vapi_phone_number_id}`, {
      method: "PATCH",
      body: { assistantId: config.vapi_assistant_id },
    });

    const { error } = await supabase
      .from("services")
      .update({ status: "live", deployed_at: new Date().toISOString() })
      .eq("id", data.serviceId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
