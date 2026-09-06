import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

type VapiToolCall = {
  id: string;
  type?: string;
  function: { name: string; arguments?: string };
};

type VapiMessage = {
  type?: string;
  call?: { id?: string; assistantId?: string; customer?: { number?: string } };
  toolCallList?: VapiToolCall[];
  artifact?: { transcript?: string; recordingUrl?: string };
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  analysis?: { successEvaluation?: string; summary?: string };
  cost?: number;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function outcomeFor(message: VapiMessage): string {
  const reason = message.endedReason ?? "";
  if (reason.includes("transfer")) return "escalated";
  if (reason.includes("no-answer") || reason.includes("failed")) return "missed";
  return "info_only";
}

function durationSecondsFor(message: VapiMessage): number | null {
  if (!message.startedAt || !message.endedAt) return null;
  const started = new Date(message.startedAt).getTime();
  const ended = new Date(message.endedAt).getTime();
  if (Number.isNaN(started) || Number.isNaN(ended) || ended < started) return null;
  return Math.round((ended - started) / 1000);
}

type SupabaseAdmin = SupabaseClient;

/** Resolves which org/service a Vapi assistant belongs to. */
async function resolveOrgForAssistant(
  supabaseAdmin: SupabaseAdmin,
  assistantId: string | undefined,
): Promise<{ orgId: string | null; serviceId: string | null; escalationNumber: string | null }> {
  if (!assistantId) return { orgId: null, serviceId: null, escalationNumber: null };

  const { data: config } = await supabaseAdmin
    .from("voice_agent_configs")
    .select("service_id, escalation_number")
    .eq("vapi_assistant_id", assistantId)
    .maybeSingle();
  if (!config?.service_id) return { orgId: null, serviceId: null, escalationNumber: null };

  const { data: service } = await supabaseAdmin
    .from("services")
    .select("org_id")
    .eq("id", config.service_id)
    .maybeSingle();

  return {
    orgId: service?.org_id ?? null,
    serviceId: config.service_id,
    escalationNumber: config.escalation_number ?? null,
  };
}

/** Finds the conversation for this call (by Vapi call ID, not by the
 * caller's phone number - a phone number is not unique per call and is not
 * always present), or creates one. Used by both the mid-call tool-calls
 * handler and the end-of-call report, so a call gets exactly one
 * conversation row no matter which handler touches it first. */
async function getOrCreateConversation(
  supabaseAdmin: SupabaseAdmin,
  params: { callId: string; assistantId: string | undefined; customerNumber: string | null },
): Promise<{ id: string; org_id: string | null } | null> {
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id, org_id")
    .eq("vapi_call_id", params.callId)
    .maybeSingle();
  if (existing) return existing;

  const { orgId, serviceId } = await resolveOrgForAssistant(supabaseAdmin, params.assistantId);

  const { data: created } = await supabaseAdmin
    .from("conversations")
    .insert({
      org_id: orgId,
      service_id: serviceId,
      channel: "voice",
      customer_identifier: params.customerNumber,
      vapi_call_id: params.callId,
      status: "active",
      is_sandbox: false,
    })
    .select("id, org_id")
    .single();

  return created ?? null;
}

const NO_BOOKING_ENGINE_MESSAGE =
  "Booking isn't set up yet. I've taken your details as a message instead.";

async function takeMessage(
  supabaseAdmin: SupabaseAdmin,
  conversationId: string,
  args: Record<string, unknown>,
): Promise<string> {
  const parts: string[] = [];
  if (typeof args["customer_name"] === "string") parts.push(`Customer: ${args["customer_name"]}`);
  if (typeof args["customer_phone"] === "string") parts.push(`Phone: ${args["customer_phone"]}`);
  parts.push(
    `Message: ${typeof args["summary"] === "string" ? args["summary"] : "(no summary given)"}`,
  );
  if (args["callback_requested"]) parts.push("Callback requested: Yes");

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    sender: "customer",
    content: parts.join("\n"),
  });

  return "I've taken your message. The business will get back to you soon.";
}

async function runTool(
  supabaseAdmin: SupabaseAdmin,
  toolCall: VapiToolCall,
  ctx: { conversationId: string; escalationNumber: string | null },
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
  } catch {
    // Malformed arguments shouldn't crash the call; fall through with {}.
  }

  switch (toolCall.function.name) {
    case "take_message":
      return takeMessage(supabaseAdmin, ctx.conversationId, args);
    case "check_availability":
    case "book_appointment":
      // No booking engine exists yet - be honest about that rather than
      // pretending to check a calendar, and fall back to taking a message.
      await takeMessage(supabaseAdmin, ctx.conversationId, {
        summary: `Customer tried to ${toolCall.function.name === "book_appointment" ? "book an appointment" : "check availability"}.`,
        callback_requested: true,
      });
      return NO_BOOKING_ENGINE_MESSAGE;
    case "transfer_call":
      // In normal operation this tool has static destinations configured
      // (see buildAssistantPayload), so Vapi handles the transfer itself
      // and never calls this webhook for it. This only runs if that's
      // somehow not the case.
      return ctx.escalationNumber
        ? `Please hold while I connect you to ${ctx.escalationNumber}.`
        : "I'm not able to transfer you right now, but I've taken a message.";
    default:
      return `I don't have a way to do that yet (${toolCall.function.name}).`;
  }
}

export const Route = createFileRoute("/api/public/vapi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["VAPI_API_KEY"] ?? "";
        const provided =
          request.headers.get("x-vapi-secret") ??
          (request.headers.get("authorization") ?? "").replace("Bearer ", "");
        if (!expected || !provided || !timingSafeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as { message?: VapiMessage };
        const message = body.message ?? {};
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (message.type === "tool-calls" && message.toolCallList?.length) {
          const callId = message.call?.id;
          const { escalationNumber } = await resolveOrgForAssistant(
            supabaseAdmin,
            message.call?.assistantId,
          );

          const conversation = callId
            ? await getOrCreateConversation(supabaseAdmin, {
                callId,
                assistantId: message.call?.assistantId,
                customerNumber: message.call?.customer?.number ?? null,
              })
            : null;

          const results = await Promise.all(
            message.toolCallList.map(async (tc) => ({
              toolCallId: tc.id,
              name: tc.function.name,
              result: conversation
                ? await runTool(supabaseAdmin, tc, {
                    conversationId: conversation.id,
                    escalationNumber,
                  })
                : "Something went wrong on our end - please try again.",
            })),
          );

          return Response.json({ results });
        }

        if (message.type === "end-of-call-report") {
          const callId = message.call?.id;
          if (!callId) return Response.json({ received: true });

          const transcript = message.artifact?.transcript ?? null;
          const recording = message.artifact?.recordingUrl ?? null;
          const summary = message.analysis?.summary ?? null;
          const cost = typeof message.cost === "number" ? message.cost : null;
          const durationSeconds = durationSecondsFor(message);
          const outcome = outcomeFor(message);
          const resolutionType = outcome === "escalated" ? "escalated" : "ai_resolved";

          const conversation = await getOrCreateConversation(supabaseAdmin, {
            callId,
            assistantId: message.call?.assistantId,
            customerNumber: message.call?.customer?.number ?? null,
          });

          if (conversation) {
            await supabaseAdmin
              .from("conversations")
              .update({
                status: "resolved",
                ended_at: new Date().toISOString(),
                resolution_type: resolutionType,
              })
              .eq("id", conversation.id);
          }

          const { data: existingLog } = await supabaseAdmin
            .from("call_logs")
            .select("id")
            .eq("vapi_call_id", callId)
            .maybeSingle();

          const logFields = {
            transcript,
            recording_url: recording,
            duration_seconds: durationSeconds,
            outcome,
            summary,
            cost_usd: cost,
          };

          if (existingLog) {
            await supabaseAdmin.from("call_logs").update(logFields).eq("id", existingLog.id);
          } else {
            await supabaseAdmin.from("call_logs").insert({
              conversation_id: conversation?.id ?? null,
              vapi_call_id: callId,
              ...logFields,
            });
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});
