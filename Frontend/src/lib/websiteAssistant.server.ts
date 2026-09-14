// Server-only: the website assistant's LLM turn. Gemini is given a compact
// summary of the current site plus a fixed set of function declarations, and
// can only respond by calling those - see assistantOps.ts for why that
// matters (the model never emits site JSON directly).
import type { AssistantDraft, AssistantOperation } from "@/components/website/assistantOps";
import { summarizeDraft } from "@/components/website/assistantOps";
import { FONT_OPTIONS } from "@/components/website/types";
import { PAGE_PRESETS } from "@/components/website/templates";

const FUNCTION_DECLARATIONS = [
  {
    name: "update_section_content",
    description:
      "Change text (or other content fields) on one section of one page. Only pass the fields you're changing. Use the exact sectionId and pageSlug from the site summary.",
    parameters: {
      type: "object",
      properties: {
        pageSlug: { type: "string", description: 'Page slug, "" for the home page.' },
        sectionId: { type: "string" },
        fields: {
          type: "object",
          description:
            'Content fields to set, e.g. {"headline": "...", "subheadline": "..."}. Never set image fields.',
        },
      },
      required: ["pageSlug", "sectionId", "fields"],
    },
  },
  {
    name: "set_theme",
    description: "Change site-wide colors, fonts or corner style.",
    parameters: {
      type: "object",
      properties: {
        primaryColor: { type: "string", description: "Hex color like #15803d" },
        accentColor: { type: "string", description: "Hex color like #f59e0b" },
        fontHeading: { type: "string", enum: [...FONT_OPTIONS] },
        fontBody: { type: "string", enum: [...FONT_OPTIONS] },
        radius: { type: "string", enum: ["none", "sm", "md", "lg", "full"] },
      },
    },
  },
  {
    name: "reorder_sections",
    description: "Set the order of sections on a page. List every sectionId in the desired order.",
    parameters: {
      type: "object",
      properties: {
        pageSlug: { type: "string" },
        sectionIds: { type: "array", items: { type: "string" } },
      },
      required: ["pageSlug", "sectionIds"],
    },
  },
  {
    name: "set_section_visible",
    description: "Show or hide a section on a page.",
    parameters: {
      type: "object",
      properties: {
        pageSlug: { type: "string" },
        sectionId: { type: "string" },
        visible: { type: "boolean" },
      },
      required: ["pageSlug", "sectionId", "visible"],
    },
  },
  {
    name: "update_nav",
    description: "Change the site-wide navigation bar.",
    parameters: {
      type: "object",
      properties: {
        businessName: { type: "string" },
        ctaText: { type: "string" },
        ctaLink: { type: "string" },
      },
    },
  },
  {
    name: "update_footer",
    description: "Change the site-wide footer.",
    parameters: {
      type: "object",
      properties: {
        businessName: { type: "string" },
        tagline: { type: "string" },
      },
    },
  },
  {
    name: "add_page",
    description: "Add a new page to the site, starting from one of the preset layouts.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: 'Page name shown in the menu, e.g. "Pricing"' },
        preset: {
          type: "string",
          enum: PAGE_PRESETS.map((p) => p.id),
          description: "Which existing layout to base the new page on.",
        },
      },
      required: ["name", "preset"],
    },
  },
  {
    name: "delete_page",
    description:
      "Delete a page. This always asks the user to confirm first, so call it when they ask to remove a page.",
    parameters: {
      type: "object",
      properties: { pageSlug: { type: "string" } },
      required: ["pageSlug"],
    },
  },
];

const SYSTEM_PROMPT = `You are the website assistant inside Aivora's website builder. You help a small business owner change their own website by calling the provided functions.

Rules:
- Make changes by calling functions. Never describe changes you haven't made.
- Use exact pageSlug and sectionId values from the site summary. The home page's slug is an empty string.
- When rewriting copy, keep it concise, specific and in the business's voice. Don't invent prices, reviews, addresses, or claims that aren't already on the site.
- Never set image fields; the owner picks images themselves.
- If a request is genuinely ambiguous (you can't tell which section or page they mean), ask one short clarifying question instead of guessing.
- After calling functions, reply in one short sentence saying what you changed.`;

export type AssistantTurn = {
  reply: string;
  operations: AssistantOperation[];
};

export async function runWebsiteAssistantTurn(args: {
  draft: AssistantDraft;
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
}): Promise<AssistantTurn> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("The assistant is not configured yet (missing GEMINI_API_KEY).");

  const contents = [
    ...args.history.slice(-8).map((turn) => ({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.text }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `Current site:\n${summarizeDraft(args.draft)}\n\nRequest: ${args.message}`,
        },
      ],
    },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.4 },
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      }),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    console.error("Website assistant Gemini error", res.status, text);
    throw new Error(`The assistant couldn't reach the AI service (${res.status}).`);
  }

  const data = JSON.parse(text) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args?: Record<string, unknown> };
        }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const replyText = parts
    .map((p) => p.text)
    .filter((t): t is string => Boolean(t))
    .join(" ")
    .trim();

  const operations: AssistantOperation[] = [];
  for (const part of parts) {
    const call = part.functionCall;
    if (!call) continue;
    const a = call.args ?? {};

    switch (call.name) {
      case "update_section_content":
        if (typeof a["pageSlug"] === "string" && typeof a["sectionId"] === "string") {
          operations.push({
            op: "update_section_content",
            pageSlug: a["pageSlug"],
            sectionId: a["sectionId"],
            fields: (a["fields"] as Record<string, unknown>) ?? {},
          });
        }
        break;
      case "set_theme":
        operations.push({ op: "set_theme", fields: a as never });
        break;
      case "reorder_sections":
        if (typeof a["pageSlug"] === "string" && Array.isArray(a["sectionIds"])) {
          operations.push({
            op: "reorder_sections",
            pageSlug: a["pageSlug"],
            sectionIds: (a["sectionIds"] as unknown[]).map(String),
          });
        }
        break;
      case "set_section_visible":
        if (typeof a["pageSlug"] === "string" && typeof a["sectionId"] === "string") {
          operations.push({
            op: "set_section_visible",
            pageSlug: a["pageSlug"],
            sectionId: a["sectionId"],
            visible: a["visible"] !== false,
          });
        }
        break;
      case "update_nav":
        operations.push({ op: "update_nav", fields: a as never });
        break;
      case "update_footer":
        operations.push({ op: "update_footer", fields: a as never });
        break;
      case "add_page":
        if (typeof a["name"] === "string") {
          operations.push({
            op: "add_page",
            name: a["name"],
            preset: typeof a["preset"] === "string" ? a["preset"] : "blank",
          });
        }
        break;
      case "delete_page":
        if (typeof a["pageSlug"] === "string") {
          operations.push({ op: "delete_page", pageSlug: a["pageSlug"] });
        }
        break;
    }
  }

  return {
    reply: replyText || (operations.length ? "Done." : "I'm not sure what to change there."),
    operations,
  };
}
