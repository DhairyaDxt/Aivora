// Server-only: executes the receptionist's function tools (take_message,
// check_availability, book_appointment). Shared by the public Vapi webhook
// (real calls) and the authenticated test-call tool endpoint (browser Test
// Call, which has no public server URL for Vapi to call back to), so both
// paths book through the exact same Calendly logic.
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseAdmin = SupabaseClient;

export const NO_BOOKING_ENGINE_MESSAGE =
  "Booking isn't set up yet. I've taken your details as a message instead.";

export async function takeMessage(
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatSlots(isoTimes: string[], timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return isoTimes.map((t) => fmt.format(new Date(t))).join(", ");
}

export async function checkAvailability(
  supabaseAdmin: SupabaseAdmin,
  orgId: string | null,
  conversationId: string,
  args: Record<string, unknown>,
  timezone: string,
): Promise<string> {
  if (!orgId) {
    await takeMessage(supabaseAdmin, conversationId, {
      summary: "Customer tried to check appointment availability.",
      callback_requested: true,
    });
    return NO_BOOKING_ENGINE_MESSAGE;
  }
  const { getValidCalendlyAccessToken, getCalendlyAvailableTimes } =
    await import("./calendly.server");
  const { resolveCallerTime } = await import("./voice.server");

  const access = await getValidCalendlyAccessToken(supabaseAdmin, orgId);
  if (!access || !access.connection.event_type_uri) {
    await takeMessage(supabaseAdmin, conversationId, {
      summary: `Customer tried to check availability${typeof args["service"] === "string" ? ` for ${args["service"]}` : ""}.`,
      callback_requested: true,
    });
    return NO_BOOKING_ENGINE_MESSAGE;
  }

  const requestedRaw = typeof args["requested_time"] === "string" ? args["requested_time"] : null;
  const resolved = requestedRaw ? resolveCallerTime(requestedRaw, timezone) : null;
  const anchor = resolved && resolved.getTime() > Date.now() ? resolved : new Date();
  const windowEnd = new Date(anchor.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const slots = await getCalendlyAvailableTimes(
      access.accessToken,
      access.connection.event_type_uri,
      anchor,
      windowEnd,
    );
    if (slots.length === 0) {
      return "There's nothing open in the next week. Would you like me to take a message so the team can follow up?";
    }
    const formatted = formatSlots(
      slots.slice(0, 5).map((s) => s.start_time),
      timezone,
    );
    return `Here are the next open times: ${formatted}. Which works best?`;
  } catch (err) {
    console.error("Calendly availability error", err);
    return "I'm having trouble reaching the calendar right now. Would you like me to take a message instead?";
  }
}

export async function bookAppointment(
  supabaseAdmin: SupabaseAdmin,
  orgId: string | null,
  conversationId: string,
  args: Record<string, unknown>,
  timezone: string,
): Promise<string> {
  if (!orgId) {
    await takeMessage(supabaseAdmin, conversationId, {
      summary: "Customer tried to book an appointment.",
      callback_requested: true,
    });
    return NO_BOOKING_ENGINE_MESSAGE;
  }

  const { getValidCalendlyAccessToken, getCalendlyAvailableTimes, createCalendlyInvitee } =
    await import("./calendly.server");
  const { resolveCallerTime } = await import("./voice.server");

  const access = await getValidCalendlyAccessToken(supabaseAdmin, orgId);
  if (!access || !access.connection.event_type_uri) {
    await takeMessage(supabaseAdmin, conversationId, {
      summary: `Customer tried to book ${typeof args["service"] === "string" ? args["service"] : "an appointment"}.`,
      callback_requested: true,
    });
    return NO_BOOKING_ENGINE_MESSAGE;
  }

  const name = typeof args["customer_name"] === "string" ? args["customer_name"].trim() : "";
  const email = typeof args["customer_email"] === "string" ? args["customer_email"].trim() : "";
  const phone = typeof args["customer_phone"] === "string" ? args["customer_phone"].trim() : "";
  const requestedRaw = typeof args["requested_time"] === "string" ? args["requested_time"] : "";

  if (!name || !requestedRaw) {
    return "I still need the caller's name and a specific day and time before I can book that.";
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return "I need a valid email address for the confirmation - could you ask the caller for one?";
  }

  const requested = resolveCallerTime(requestedRaw, timezone);
  if (!requested || requested.getTime() < Date.now() - 60_000) {
    return "That time doesn't look valid or has already passed - could you confirm a specific upcoming day and time with the caller?";
  }

  try {
    // Defensive re-check: the slot may have been taken since the model last
    // called check_availability, so never trust it blindly.
    const dayWindowEnd = new Date(requested.getTime() + 24 * 60 * 60 * 1000);
    const slots = await getCalendlyAvailableTimes(
      access.accessToken,
      access.connection.event_type_uri,
      requested,
      dayWindowEnd,
    );
    const stillOpen = slots.some(
      (s) => Math.abs(new Date(s.start_time).getTime() - requested.getTime()) < 60_000,
    );
    if (!stillOpen) {
      return "That exact time isn't available anymore - please check availability again and offer the caller a different slot.";
    }

    await createCalendlyInvitee(access.accessToken, {
      eventTypeUri: access.connection.event_type_uri,
      startTime: requested.toISOString(),
      name,
      email,
      timezone,
      ...(phone ? { smsReminderNumber: phone } : {}),
    });

    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      sender: "ai",
      content: `Booked via Calendly: ${name} (${email}) at ${requested.toISOString()}.`,
    });

    const when = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(requested);
    return `Booked for ${when}. A confirmation email is on its way to ${email}.`;
  } catch (err) {
    console.error("Calendly booking error", err);
    await takeMessage(supabaseAdmin, conversationId, {
      customer_name: name,
      summary: `Wanted to book ${typeof args["service"] === "string" ? args["service"] : "an appointment"} at ${requestedRaw}, but automatic booking failed.`,
      callback_requested: true,
    });
    return "Something went wrong booking that automatically. I've taken a message so the team can confirm it with you directly.";
  }
}

export async function runVoiceTool(
  supabaseAdmin: SupabaseAdmin,
  toolName: string,
  args: Record<string, unknown>,
  ctx: {
    conversationId: string;
    escalationNumber: string | null;
    orgId: string | null;
    timezone: string;
  },
): Promise<string> {
  switch (toolName) {
    case "take_message":
      return takeMessage(supabaseAdmin, ctx.conversationId, args);
    case "check_availability":
      return checkAvailability(supabaseAdmin, ctx.orgId, ctx.conversationId, args, ctx.timezone);
    case "book_appointment":
      return bookAppointment(supabaseAdmin, ctx.orgId, ctx.conversationId, args, ctx.timezone);
    case "transfer_call":
      // In normal operation this tool has static destinations configured on
      // the assistant itself (see buildAssistantPayload), so Vapi handles
      // the transfer directly and this only runs if that's somehow not the
      // case (e.g. no escalation number configured yet).
      return ctx.escalationNumber
        ? `Please hold while I connect you to ${ctx.escalationNumber}.`
        : "I'm not able to transfer you right now, but I've taken a message.";
    default:
      return `I don't have a way to do that yet (${toolName}).`;
  }
}
