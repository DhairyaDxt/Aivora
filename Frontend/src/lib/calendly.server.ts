// Server-only helpers for the Calendly integration: OAuth token exchange,
// the Calendly API v2 client, and per-org token storage/refresh. Never
// imported from client code.
import type { SupabaseClient } from "@supabase/supabase-js";

const CALENDLY_AUTH_BASE = "https://auth.calendly.com";
const CALENDLY_API_BASE = "https://api.calendly.com";

function oauthCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env["CALENDLY_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["CALENDLY_OAUTH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("Calendly isn't configured on this server yet.");
  }
  return { clientId, clientSecret };
}

export function calendlyAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = oauthCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${CALENDLY_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

type CalendlyTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  owner: string;
  organization: string;
};

async function tokenRequest(form: Record<string, string>): Promise<CalendlyTokenResponse> {
  const { clientId, clientSecret } = oauthCreds();
  const res = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...form }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Calendly token error", res.status, text);
    throw new Error("Calendly rejected that connection request.");
  }
  return JSON.parse(text) as CalendlyTokenResponse;
}

export function exchangeCalendlyCode(code: string, redirectUri: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshCalendlyToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function calendlyFetch<T = unknown>(
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${CALENDLY_API_BASE}${path}`);
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Calendly API error", res.status, text);
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { message?: string; title?: string };
      detail = parsed.message || parsed.title || "";
    } catch {
      // response wasn't JSON; fall through with no extra detail
    }
    throw new Error(`Calendly rejected the request (${res.status})${detail ? `: ${detail}` : "."}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type CalendlyUser = {
  resource: {
    uri: string;
    name: string;
    email: string;
    scheduling_url: string;
    timezone: string;
    current_organization: string;
  };
};

export function getCalendlyCurrentUser(accessToken: string) {
  return calendlyFetch<CalendlyUser>(accessToken, "/users/me");
}

export type CalendlyEventType = {
  uri: string;
  name: string;
  duration: number;
  scheduling_url: string;
  active: boolean;
};

export async function listCalendlyEventTypes(accessToken: string, userUri: string) {
  const res = await calendlyFetch<{ collection: CalendlyEventType[] }>(
    accessToken,
    "/event_types",
    { query: { user: userUri, active: "true" } },
  );
  return res.collection;
}

export type CalendlyAvailableSlot = {
  status: string;
  start_time: string;
  invitees_remaining: number;
};

/** Calendly caps each availability window at 31 days per request. */
export async function getCalendlyAvailableTimes(
  accessToken: string,
  eventTypeUri: string,
  startTime: Date,
  endTime: Date,
) {
  const res = await calendlyFetch<{ collection: CalendlyAvailableSlot[] }>(
    accessToken,
    "/event_type_available_times",
    {
      query: {
        event_type: eventTypeUri,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      },
    },
  );
  return res.collection.filter((s) => s.status === "available");
}

export async function createCalendlyInvitee(
  accessToken: string,
  params: {
    eventTypeUri: string;
    startTime: string;
    name: string;
    email: string;
    timezone: string;
    smsReminderNumber?: string;
  },
) {
  return calendlyFetch<{
    resource: {
      uri: string;
      status: string;
      start_time: string;
      cancel_url: string;
      reschedule_url: string;
    };
  }>(accessToken, "/invitees", {
    method: "POST",
    body: {
      event_type: params.eventTypeUri,
      start_time: params.startTime,
      invitee: {
        name: params.name,
        email: params.email,
        timezone: params.timezone,
        ...(params.smsReminderNumber ? { text_reminder_number: params.smsReminderNumber } : {}),
      },
      location: { kind: "physical" },
    },
  });
}

type CalendlyConnectionRow = {
  org_id: string;
  calendly_user_uri: string;
  organization_uri: string | null;
  scheduling_url: string | null;
  owner_name: string | null;
  owner_email: string | null;
  timezone: string | null;
  event_type_uri: string | null;
  event_type_name: string | null;
  event_type_duration_minutes: number | null;
  access_token_secret_ref: string;
  refresh_token_secret_ref: string;
  token_expires_at: string;
  status: string;
};

/** Refreshes ~2 minutes before actual expiry to absorb request latency. */
const EXPIRY_SKEW_MS = 2 * 60 * 1000;

/**
 * Returns a live access token for the org's Calendly connection, refreshing
 * it first if it's expired or about to expire. Returns null if the org has
 * no Calendly connection at all - callers should fall back to "not connected"
 * behaviour rather than throwing, since most orgs won't have one.
 */
export async function getValidCalendlyAccessToken(
  supabaseAdmin: SupabaseClient,
  orgId: string,
): Promise<{ accessToken: string; connection: CalendlyConnectionRow } | null> {
  const { data: connection } = await supabaseAdmin
    .from("calendly_connections")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!connection) return null;
  const row = connection as CalendlyConnectionRow;

  const expiresAt = new Date(row.token_expires_at).getTime();
  if (Date.now() < expiresAt - EXPIRY_SKEW_MS) {
    const { data: accessToken } = await supabaseAdmin.rpc("read_calendly_secret", {
      p_name: row.access_token_secret_ref,
    });
    if (accessToken) return { accessToken: accessToken as string, connection: row };
  }

  const { data: refreshToken } = await supabaseAdmin.rpc("read_calendly_secret", {
    p_name: row.refresh_token_secret_ref,
  });
  if (!refreshToken) return null;

  const refreshed = await refreshCalendlyToken(refreshToken as string);
  await Promise.all([
    supabaseAdmin.rpc("store_calendly_secret", {
      p_name: row.access_token_secret_ref,
      p_secret: refreshed.access_token,
    }),
    supabaseAdmin.rpc("store_calendly_secret", {
      p_name: row.refresh_token_secret_ref,
      p_secret: refreshed.refresh_token,
    }),
  ]);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("calendly_connections")
    .update({ token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq("org_id", orgId);

  return {
    accessToken: refreshed.access_token,
    connection: { ...row, token_expires_at: newExpiresAt },
  };
}
