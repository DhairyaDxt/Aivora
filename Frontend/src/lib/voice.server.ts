// Server-only helpers for the voice channel: Vapi and Twilio HTTP calls plus
// the system prompt builder. Never imported from client code.

const VAPI_BASE = "https://api.vapi.ai";
const TWILIO_BASE = "https://api.twilio.com/2010-04-01";
const PRICING_BASE = "https://pricing.twilio.com";

export const FREE_NUMBER_LIMIT = 5;

function vapiKey(): string {
  const key = process.env["VAPI_API_KEY"];
  if (!key) throw new Error("The voice provider connection is not configured yet.");
  return key;
}

export async function vapiFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${vapiKey()}`,
      "Content-Type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Vapi error", res.status, text);
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) detail = parsed.message.join(" ");
      else if (typeof parsed.message === "string") detail = parsed.message;
    } catch {
      // response wasn't JSON; fall through with no extra detail
    }
    throw new Error(
      `The voice provider rejected the request (${res.status})${detail ? `: ${detail}` : "."}`,
    );
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function twilioAuthHeader(sid: string, token: string) {
  return `Basic ${btoa(`${sid}:${token}`)}`;
}

export function twilioMasterCreds() {
  const sid = process.env["TWILIO_MASTER_ACCOUNT_SID"];
  const token = process.env["TWILIO_MASTER_AUTH_TOKEN"];
  if (!sid || !token)
    throw new Error("The phone number provider connection is not configured yet.");
  return { sid, token };
}

export async function twilioFetch<T = unknown>(
  url: string,
  creds: { sid: string; token: string },
  init: { method?: string; form?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: twilioAuthHeader(creds.sid, creds.token),
      ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(init.form ? { body: new URLSearchParams(init.form).toString() } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Twilio error", res.status, text);
    throw new Error(`The phone number provider rejected the request (${res.status}).`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export const twilioUrls = {
  accounts: () => `${TWILIO_BASE}/Accounts.json`,
  availableLocal: (sid: string, country: string, areaCode?: string) =>
    `${TWILIO_BASE}/Accounts/${sid}/AvailablePhoneNumbers/${country}/Local.json?PageSize=10${
      areaCode ? `&AreaCode=${encodeURIComponent(areaCode)}` : ""
    }`,
  incoming: (sid: string) => `${TWILIO_BASE}/Accounts/${sid}/IncomingPhoneNumbers.json`,
  numberPricing: (country: string) => `${PRICING_BASE}/v1/PhoneNumbers/Countries/${country}`,
  voicePricing: (country: string) => `${PRICING_BASE}/v1/Voice/Countries/${country}`,
};

type Hours = Record<string, Array<{ open: string; close: string }>> | null;

export type PromptInputs = {
  business: {
    display_name: string | null;
    legal_name: string | null;
    description: string | null;
    address: unknown;
    business_hours: Hours;
    languages: string[] | null;
  } | null;
  org: {
    name: string;
    industry_vertical: string | null;
    timezone: string;
    country: string | null;
  } | null;
  config: {
    persona_name: string | null;
    consent_enabled: boolean | null;
    consent_message: string | null;
    after_hours_behavior: string | null;
    escalation_number: string | null;
    kb_enabled: boolean | null;
    business_hours_override: Hours;
    multilingual_enabled: boolean | null;
  };
  knowledge: Array<{ type: string; title: string | null; content: string }>;
};

const KB_CHAR_BUDGET = 12000;

function currentTimeLine(timezone: string | undefined): string {
  if (!timezone) return "";
  try {
    const now = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
    return `Right now it is ${now} (${timezone}). Resolve relative dates the caller mentions ("tomorrow", "next Tuesday", "in an hour") against this.`;
  } catch {
    return "";
  }
}

export function buildSystemPrompt(input: PromptInputs): string {
  const { business, org, config, knowledge } = input;
  const name = business?.display_name || org?.name || "this business";
  const hours = config.business_hours_override ?? business?.business_hours ?? null;

  const lines: string[] = [
    `You are ${config.persona_name || "the receptionist"}, the AI phone receptionist for ${name}.`,
    org?.industry_vertical ? `The business operates in: ${org.industry_vertical}.` : "",
    business?.description ? `About the business: ${business.description}` : "",
    org?.timezone ? `All times you mention are in the ${org.timezone} timezone.` : "",
    currentTimeLine(org?.timezone),
    hours ? `Opening hours: ${JSON.stringify(hours)}` : "",
    business?.address ? `Address: ${JSON.stringify(business.address)}` : "",
    "",
    "How to behave:",
    "- Be warm, brief and natural. One question at a time.",
    "- Never invent prices, availability or policies. If you do not know, offer to take a message.",
    config.escalation_number
      ? `- If the caller asks for a human or is upset, offer to transfer them to ${config.escalation_number}.`
      : "- If the caller asks for a human, take a message instead.",
    `- Outside opening hours, follow this behaviour: ${config.after_hours_behavior || "voicemail"}.`,
    config.consent_enabled && config.consent_message
      ? `- You have already told the caller: "${config.consent_message}"`
      : "",
  ];

  if (config.kb_enabled && knowledge.length > 0) {
    let kb = "";
    for (const entry of knowledge) {
      const chunk = `\n[${entry.type}] ${entry.title ?? ""}\n${entry.content}\n`;
      if (kb.length + chunk.length > KB_CHAR_BUDGET) break;
      kb += chunk;
    }
    lines.push("", "Business knowledge you can rely on:", kb.trim());
  }

  // Deliberately last: everything above (persona, policies, the whole
  // knowledge base) is written in English and can run to thousands of
  // characters, which drowns out a language instruction placed earlier and
  // leaves the model defaulting back to English.
  if (config.multilingual_enabled) {
    lines.push(
      "",
      "LANGUAGE (most important rule):",
      "- The caller may speak any language. Identify the language of the caller's own words and reply ONLY in that language.",
      "- These instructions and the business information above are written in English purely for your reference. That is NOT a reason to answer in English.",
      "- If the caller speaks Hindi, answer in Hindi. If they speak Spanish, answer in Spanish. And so on, for the whole call.",
      "- If the caller switches language mid-call, switch with them.",
    );
  }

  return lines.filter(Boolean).join("\n");
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/**
 * The model resolves caller-relative times ("tomorrow at 3pm") against the
 * current-time line in the system prompt and returns an ISO 8601 string, but
 * it usually omits a UTC offset - which JS would otherwise parse as the
 * *server's* local time, not the business's. If the string already carries
 * an offset (trailing Z or +hh:mm), it's used as-is; otherwise it's treated
 * as wall-clock time in `timezone`.
 */
export function resolveCallerTime(requestedTime: string, timezone: string): Date | null {
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(requestedTime.trim());
  if (hasOffset) {
    const parsed = new Date(requestedTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const guess = new Date(`${requestedTime}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  return new Date(guess.getTime() - timezoneOffsetMs(guess, timezone));
}

export const VAPI_FUNCTION_DEFS: Record<string, unknown> = {
  check_availability: {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Look up real open appointment slots near a time the caller asked about. Call this before book_appointment so you can offer the caller a real, bookable time rather than guessing.",
      parameters: {
        type: "object",
        properties: {
          requested_time: {
            type: "string",
            description:
              "The date/time the caller is interested in, resolved to an exact ISO 8601 timestamp (e.g. 2026-09-08T15:00:00) using the current date and timezone given above. If the caller gave no specific time, use the current date.",
          },
          service: { type: "string", description: "What the caller wants booked." },
        },
        required: ["requested_time"],
      },
    },
  },
  book_appointment: {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Book an appointment for the caller at an exact time you already confirmed is open via check_availability. Always get the caller's name and a real email address first - Calendly emails the confirmation and calendar invite to it.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "The caller's full name." },
          customer_email: {
            type: "string",
            description: "The caller's email address, for the confirmation and calendar invite.",
          },
          customer_phone: {
            type: "string",
            description: "The caller's phone number, for an SMS reminder if available.",
          },
          requested_time: {
            type: "string",
            description:
              "The exact slot to book, as an ISO 8601 timestamp matching one returned by check_availability.",
          },
          service: { type: "string", description: "What the caller wants booked." },
        },
        required: ["customer_name", "customer_email", "requested_time"],
      },
    },
  },
  take_message: {
    type: "function",
    function: {
      name: "take_message",
      description: "Record a message for the business owner.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          callback_number: { type: "string" },
          message: { type: "string" },
        },
        required: ["message"],
      },
    },
  },
};

// Each TTS provider only accepts its own voiceId/model values, so a stale pair
// left over from switching providers must never reach Vapi as-is.
const VOICE_PROVIDER_DEFAULTS: Record<string, { voiceId: string; model: string }> = {
  "11labs": { voiceId: "burt", model: "eleven_turbo_v2_5" },
  playht: { voiceId: "jennifer", model: "PlayHT2.0-turbo" },
  openai: { voiceId: "alloy", model: "tts-1" },
};

// Vapi's voice.model is a closed enum per provider (no custom strings allowed).
const VOICE_PROVIDER_MODELS: Record<string, string[]> = {
  "11labs": [
    "eleven_multilingual_v2",
    "eleven_turbo_v2",
    "eleven_turbo_v2_5",
    "eleven_flash_v2",
    "eleven_flash_v2_5",
    "eleven_monolingual_v1",
    "eleven_v3",
  ],
  playht: ["PlayHT2.0", "PlayHT2.0-turbo", "Play3.0-mini", "PlayDialog"],
  openai: ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"],
};

// voiceId accepts custom provider IDs too, but a preset name that belongs to a
// *different* provider is always a leftover from switching providers.
const VOICE_PROVIDER_PRESETS: Record<string, string[]> = {
  "11labs": [
    "burt",
    "marissa",
    "andrea",
    "sarah",
    "phillip",
    "steve",
    "joseph",
    "myra",
    "paula",
    "ryan",
    "drew",
    "paul",
    "mrb",
    "matilda",
    "mark",
  ],
  playht: [
    "jennifer",
    "melissa",
    "will",
    "chris",
    "matt",
    "jack",
    "ruby",
    "davis",
    "donna",
    "michael",
  ],
  openai: ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "marin", "cedar"],
};

function resolveVoice(
  voiceProvider: string | null,
  voiceId: string | null,
  voiceModel: string | null,
) {
  const provider = voiceProvider ?? "11labs";
  const defaults = VOICE_PROVIDER_DEFAULTS[provider] ?? VOICE_PROVIDER_DEFAULTS["11labs"]!;

  const model =
    voiceModel && VOICE_PROVIDER_MODELS[provider]?.includes(voiceModel)
      ? voiceModel
      : defaults.model;

  const belongsToOtherProvider = Object.entries(VOICE_PROVIDER_PRESETS).some(
    ([p, presets]) => p !== provider && presets.includes(voiceId ?? ""),
  );
  const voiceIdResolved = voiceId && !belongsToOtherProvider ? voiceId : defaults.voiceId;

  return { provider, voiceId: voiceIdResolved, model };
}

const END_CALL_PHRASES = [
  "goodbye",
  "bye bye",
  "that's all, thanks",
  "talk to you later",
  "have a good one",
];

export function buildAssistantPayload(args: {
  prompt: string;
  config: {
    persona_name: string | null;
    greeting_script: string | null;
    consent_enabled: boolean | null;
    consent_message: string | null;
    transcriber_provider: string | null;
    transcriber_model: string | null;
    transcriber_language: string | null;
    llm_provider: string | null;
    llm_model: string | null;
    temperature: number | null;
    custom_llm_url: string | null;
    custom_llm_headers: Record<string, string> | null;
    voice_provider: string | null;
    voice_id: string | null;
    voice_model: string | null;
    functions_enabled: Record<string, boolean> | null;
    escalation_number: string | null;
    max_call_duration_seconds: number | null;
    recording_enabled: boolean | null;
    barge_in_enabled: boolean | null;
    first_message_mode: string | null;
    background_sound: string | null;
    voicemail_detection_enabled: boolean | null;
    voicemail_message: string | null;
    end_call_message: string | null;
    end_call_phrases_enabled: boolean | null;
    call_summary_enabled: boolean | null;
    transfer_destinations: Array<{ name: string; number: string; description?: string }> | null;
    warm_transfer_enabled: boolean | null;
    multilingual_enabled: boolean | null;
  };
  serverUrl?: string | undefined;
  name: string;
  metadata?: Record<string, string>;
}) {
  const { config, prompt } = args;
  const enabled = config.functions_enabled ?? {};
  const tools: unknown[] = Object.entries(VAPI_FUNCTION_DEFS)
    .filter(([key]) => enabled[key])
    .map(([, def]) => def);
  if (enabled["transfer_call"]) {
    // Named destinations let the model pick where to send the caller (e.g.
    // "Sales" vs "Support"); fall back to the single escalation number.
    const named = config.transfer_destinations ?? [];
    const destinations =
      named.length > 0
        ? named.map((d) => ({
            type: "number" as const,
            number: d.number,
            name: d.name,
            description: d.description,
            ...(config.warm_transfer_enabled !== false
              ? { transferPlan: { mode: "warm-transfer-say-summary" as const } }
              : {}),
          }))
        : config.escalation_number
          ? [
              {
                type: "number" as const,
                number: config.escalation_number,
                ...(config.warm_transfer_enabled !== false
                  ? { transferPlan: { mode: "warm-transfer-say-summary" as const } }
                  : {}),
              },
            ]
          : [];
    if (destinations.length > 0) {
      tools.push({ type: "transferCall", destinations });
    }
  }

  const firstMessage = [
    config.greeting_script ?? `Thanks for calling. How can I help?`,
    config.consent_enabled ? config.consent_message : null,
  ]
    .filter(Boolean)
    .join(" ");

  const model = config.custom_llm_url
    ? {
        provider: "custom-llm",
        url: config.custom_llm_url,
        model: config.llm_model ?? "gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
        tools,
        ...(config.custom_llm_headers ? { headers: config.custom_llm_headers } : {}),
      }
    : {
        provider: config.llm_provider ?? "openai",
        model: config.llm_model ?? "gpt-4o-mini",
        temperature: config.temperature ?? 0.5,
        messages: [{ role: "system", content: prompt }],
        tools,
      };

  const voice = resolveVoice(config.voice_provider, config.voice_id, config.voice_model);
  const transcriberProvider = config.transcriber_provider ?? "deepgram";
  const multilingual = config.multilingual_enabled === true;

  // Multilingual mode needs four things to line up: a transcriber model that
  // can code-switch, that transcriber set to "multi", a TTS model that can
  // speak more than one language, and (in buildSystemPrompt) an instruction
  // to reply in kind. Miss any one and the call silently stays English-only.
  const voiceModel = multilingual
    ? (voice.provider === "11labs" && "eleven_multilingual_v2") ||
      (voice.provider === "playht" && "PlayDialog") ||
      voice.model
    : voice.model;
  const deepgramMultilingual = multilingual && transcriberProvider === "deepgram";
  const transcriberLanguage = deepgramMultilingual
    ? "multi"
    : (config.transcriber_language ?? "en");
  // Deepgram's "multi" only code-switches between Spanish and English on
  // nova-2; nova-3 covers English, Spanish, French, German, Hindi, Russian,
  // Portuguese, Japanese, Italian and Dutch. Anything else the caller speaks
  // comes back as garbled English, so the model answers in English and the
  // whole feature looks broken - force the model that can actually do it.
  const transcriberModel = deepgramMultilingual ? "nova-3" : (config.transcriber_model ?? "nova-2");

  return {
    name: args.name,
    firstMessage,
    model,
    voice: {
      provider: voice.provider,
      voiceId: voice.voiceId,
      model: voiceModel,
    },
    transcriber: {
      provider: transcriberProvider,
      model: transcriberModel,
      language: transcriberLanguage,
    },
    maxDurationSeconds: config.max_call_duration_seconds ?? 600,
    firstMessageMode: config.first_message_mode ?? "assistant-speaks-first",
    backgroundSound: config.background_sound ?? "office",
    artifactPlan: { recordingEnabled: config.recording_enabled ?? true },
    // numWords is how many words the caller must say before they can interrupt the
    // assistant: 0 (default) is most interruptible, 10 is the max supported by Vapi.
    ...(config.barge_in_enabled === false ? { stopSpeakingPlan: { numWords: 10 } } : {}),
    ...(config.voicemail_detection_enabled
      ? {
          voicemailDetection: { provider: "openai" as const },
          voicemailMessage:
            config.voicemail_message ??
            "Sorry we missed you. Please call back or leave a message and we'll get back to you.",
        }
      : {}),
    ...(config.end_call_phrases_enabled
      ? {
          endCallPhrases: END_CALL_PHRASES,
          endCallMessage: config.end_call_message ?? "Thanks for calling, goodbye!",
        }
      : {}),
    ...(config.call_summary_enabled !== false ? { analysisPlan: { summaryPlan: {} } } : {}),
    ...(args.serverUrl ? { server: { url: args.serverUrl } } : {}),
    ...(args.metadata ? { metadata: args.metadata } : {}),
    // When there's no serverUrl (local dev - Vapi's cloud can't reach
    // "localhost"), function tools fall back to client-side delivery: Vapi
    // sends a "tool-calls" message to the browser instead of calling a
    // webhook, and the client (TestCallDrawer) executes it and reports the
    // result back into the conversation via vapi.addMessage(). This needs
    // "tool-calls" in clientMessages or the browser never receives it.
    clientMessages: ["transcript", "tool-calls", "status-update", "speech-update", "hang"],
  };
}
