import { createFileRoute } from "@tanstack/react-router";

type WhatsappTextMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
};

type WhatsappWebhookValue = {
  metadata?: { phone_number_id?: string };
  messages?: WhatsappTextMessage[];
};

type WhatsappWebhookBody = {
  entry?: Array<{
    changes?: Array<{ field?: string; value?: WhatsappWebhookValue }>;
  }>;
};

function extractText(message: WhatsappTextMessage): string | null {
  if (message.type === "text" && message.text?.body) return message.text.body;
  if (message.type === "button" && message.button?.text) return message.button.text;
  if (message.type === "interactive") {
    return (
      message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null
    );
  }
  return null;
}

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      // Meta's one-time webhook verification handshake, run when the webhook
      // URL is registered/updated on the Meta App.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env["META_WEBHOOK_VERIFY_TOKEN"] ?? "";

        if (mode === "subscribe" && expected && token === expected && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { verifyMetaWebhookSignature } = await import("@/lib/whatsapp.server");
        const signature = request.headers.get("x-hub-signature-256");
        if (!verifyMetaWebhookSignature(rawBody, signature)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = JSON.parse(rawBody) as WhatsappWebhookBody;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const {
          resolveWhatsappServiceByPhoneNumberId,
          getValidWhatsappAccessToken,
          getOrCreateWhatsappConversation,
          generateWhatsappReply,
          sendWhatsappTextMessage,
          markWhatsappMessageRead,
        } = await import("@/lib/whatsapp.server");

        for (const entry of body.entry ?? []) {
          for (const change of entry.changes ?? []) {
            const value = change.value;
            const phoneNumberId = value?.metadata?.phone_number_id;
            const messages = value?.messages ?? [];
            if (!phoneNumberId || messages.length === 0) continue;

            const resolved = await resolveWhatsappServiceByPhoneNumberId(
              supabaseAdmin,
              phoneNumberId,
            );
            if (!resolved) continue;
            const { orgId, config } = resolved;

            const accessToken = await getValidWhatsappAccessToken(supabaseAdmin, config);
            if (!accessToken) continue;

            for (const message of messages) {
              // Idempotency: Meta retries webhook delivery on any slow/failed
              // response, and this partial-unique index rejects a duplicate
              // wa_message_id outright rather than double-processing it.
              const { data: already } = await supabaseAdmin
                .from("messages")
                .select("id")
                .eq("wa_message_id", message.id)
                .maybeSingle();
              if (already) continue;

              const text = extractText(message);
              if (!text) continue;

              void markWhatsappMessageRead(accessToken, phoneNumberId, message.id);

              const conversation = await getOrCreateWhatsappConversation(supabaseAdmin, {
                orgId,
                serviceId: config.service_id,
                customerIdentifier: message.from,
                isSandbox: false,
              });

              await supabaseAdmin.from("messages").insert({
                conversation_id: conversation.id,
                sender: "customer",
                content: text,
                wa_message_id: message.id,
              });
              await supabaseAdmin
                .from("conversations")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", conversation.id);

              // A human has already taken this thread over - don't talk over them.
              if (conversation.status === "escalated") continue;

              if (conversation.isNew && config.welcome_message) {
                await sendWhatsappTextMessage(
                  accessToken,
                  phoneNumberId,
                  message.from,
                  config.welcome_message,
                );
                await supabaseAdmin.from("messages").insert({
                  conversation_id: conversation.id,
                  sender: "ai",
                  content: config.welcome_message,
                });
              }

              const [{ data: org }, { data: business }] = await Promise.all([
                supabaseAdmin
                  .from("organizations")
                  .select("name, industry_vertical, timezone, country")
                  .eq("id", orgId)
                  .maybeSingle(),
                supabaseAdmin
                  .from("business_profiles")
                  .select(
                    "display_name, legal_name, description, address, business_hours, languages",
                  )
                  .eq("org_id", orgId)
                  .maybeSingle(),
              ]);

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

              try {
                const { replyText } = await generateWhatsappReply(
                  supabaseAdmin,
                  {
                    orgId,
                    serviceId: config.service_id,
                    conversationId: conversation.id,
                    timezone: org?.timezone ?? "UTC",
                    business: business as never,
                    org: org as never,
                    config,
                  },
                  chatHistory,
                );

                await sendWhatsappTextMessage(accessToken, phoneNumberId, message.from, replyText);
                await supabaseAdmin.from("messages").insert({
                  conversation_id: conversation.id,
                  sender: "ai",
                  content: replyText,
                });
                await supabaseAdmin
                  .from("conversations")
                  .update({ last_message_at: new Date().toISOString() })
                  .eq("id", conversation.id);
              } catch (error) {
                console.error("WhatsApp reply generation failed", error);
              }
            }
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});
