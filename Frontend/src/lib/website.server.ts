// Server-only helpers for the Website Builder: Vercel Deployments API calls,
// the Gemini-powered copy generator, and the static publish renderer. Never
// imported from client code.
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type {
  FooterContent,
  NavContent,
  SiteSection,
  ThemeConfig,
} from "@/components/website/types";
import { getTemplate } from "@/components/website/templates";
import { SiteRenderer } from "@/components/website/SiteRenderer";
import { themeCssVarsString, googleFontsHref } from "@/components/website/theme";

const VERCEL_BASE = "https://api.vercel.com";

export async function vercelFetch<T = unknown>(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${VERCEL_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Vercel API error", res.status, text);
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      detail = parsed.error?.message ?? "";
    } catch {
      // response wasn't JSON; fall through with no extra detail
    }
    throw new Error(`Vercel rejected the request (${res.status})${detail ? `: ${detail}` : "."}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type VercelUser = { user: { username: string; email: string } };

export function getVercelUser(token: string) {
  return vercelFetch<VercelUser>("/v2/user", token);
}

export type VercelDeployment = {
  id: string;
  url: string;
  readyState?: string;
  projectId?: string;
};

/** Deploys a small static site via inline file contents - no build step, no
 * server runtime needed for a marketing site. Vercel creates the project
 * automatically on first deploy under this name. */
export function createDeployment(
  token: string,
  args: { projectName: string; files: Record<string, string> },
) {
  return vercelFetch<VercelDeployment>("/v13/deployments", token, {
    method: "POST",
    body: {
      name: args.projectName,
      target: "production",
      projectSettings: { framework: null },
      files: Object.entries(args.files).map(([file, data]) => ({ file, data })),
    },
  });
}

// ---------------------------------------------------------------------------
// AI copy generation (Gemini) - writes marketing copy ONLY. It never invents
// facts: contact details come straight from the business's own profile, and
// testimonials are never fabricated (a fake review attributed as a real
// customer quote would be actively misleading to site visitors) - those
// stay as obvious placeholders for the business to replace with real ones.
// ---------------------------------------------------------------------------

type CopyFields = {
  hero?: { eyebrow?: string; headline?: string; subheadline?: string; ctaText?: string };
  about?: { headline?: string; body?: string };
  services?: {
    headline?: string;
    subheadline?: string;
    items?: Array<{ title?: string; description?: string }>;
  };
  gallery?: { headline?: string };
  contactBooking?: { headline?: string; description?: string };
  footer?: { tagline?: string };
};

async function geminiGenerateJson(prompt: string): Promise<unknown> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey)
    throw new Error("The AI copy service is not configured yet (missing GEMINI_API_KEY).");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error("Gemini error", res.status, text);
    throw new Error(`The AI copy service rejected the request (${res.status}).`);
  }
  const data = JSON.parse(text) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("The AI copy service returned an empty response.");
  return JSON.parse(raw);
}

export async function generateWebsiteCopyFields(args: {
  templateId: string;
  businessName: string;
  industryVertical: string | null;
  description: string | null;
  knowledge: Array<{ title: string | null; content: string }>;
}): Promise<CopyFields> {
  const template = getTemplate(args.templateId);
  const sectionTypes = new Set(
    template?.pages.flatMap((page) => page.sections.map((s) => s.type)) ?? [],
  );

  const knowledgeText = args.knowledge
    .slice(0, 15)
    .map((k) => `- ${k.title ? `${k.title}: ` : ""}${k.content}`)
    .join("\n");

  const prompt = `You are writing marketing copy for a small business website. Only use the facts given below - never invent prices, reviews, addresses, or claims not supported by this information.

Business name: ${args.businessName}
Industry: ${args.industryVertical ?? "not specified"}
Description: ${args.description ?? "not provided"}
Known facts (services, policies, etc.):
${knowledgeText || "none provided"}

Write concise, natural, non-generic copy. Return ONLY a JSON object with exactly this shape (omit any section not listed, keep arrays short):
{
${sectionTypes.has("hero") ? `  "hero": { "eyebrow": "short label, optional", "headline": "short punchy headline", "subheadline": "one sentence", "ctaText": "2-3 word button label" },\n` : ""}${sectionTypes.has("about") ? `  "about": { "headline": "short heading", "body": "2-3 sentence paragraph about the business" },\n` : ""}${sectionTypes.has("services") ? `  "services": { "headline": "short heading", "subheadline": "one short sentence, optional", "items": [ { "title": "service name", "description": "one sentence" } ] },\n` : ""}${sectionTypes.has("gallery") ? `  "gallery": { "headline": "short heading" },\n` : ""}${sectionTypes.has("contactBooking") ? `  "contactBooking": { "headline": "short heading", "description": "one short inviting sentence" },\n` : ""}${sectionTypes.has("footer") ? `  "footer": { "tagline": "one short phrase" }\n` : ""}}`;

  const result = await geminiGenerateJson(prompt);
  return result as CopyFields;
}

/** Merges AI-written copy fields into a template's default sections,
 * touching only the specific text fields listed above - never images,
 * prices, testimonials, or contact facts. */
export function applyCopyToSections(sections: SiteSection[], copy: CopyFields): SiteSection[] {
  return sections.map((section) => {
    if (section.type === "hero" && copy.hero) {
      return { ...section, content: { ...section.content, ...copy.hero } };
    }
    if (section.type === "about" && copy.about) {
      return { ...section, content: { ...section.content, ...copy.about } };
    }
    if (section.type === "services" && copy.services) {
      const items = copy.services.items?.length
        ? section.content.items.map((item, i) => ({
            ...item,
            title: copy.services?.items?.[i]?.title ?? item.title,
            description: copy.services?.items?.[i]?.description ?? item.description,
          }))
        : section.content.items;
      return {
        ...section,
        content: {
          ...section.content,
          ...(copy.services.headline ? { headline: copy.services.headline } : {}),
          ...(copy.services.subheadline ? { subheadline: copy.services.subheadline } : {}),
          items,
        },
      };
    }
    if (section.type === "gallery" && copy.gallery) {
      return { ...section, content: { ...section.content, ...copy.gallery } };
    }
    if (section.type === "contactBooking" && copy.contactBooking) {
      return { ...section, content: { ...section.content, ...copy.contactBooking } };
    }
    if (section.type === "footer" && copy.footer) {
      return { ...section, content: { ...section.content, ...copy.footer } };
    }
    return section;
  });
}

// ---------------------------------------------------------------------------
// Static publish render
// ---------------------------------------------------------------------------

/** Toggles [data-reveal] elements' inline opacity/transform on scroll into
 * view - a plain-JS stand-in for what FadeIn.tsx's React state does in the
 * editor, since the published site has no React/hydration running at all
 * (see FadeIn.tsx for why the SSR-safe starting state matters here). */
const REVEAL_SCRIPT = `
document.querySelectorAll('[data-reveal]').forEach(function (el) {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        el.style.opacity = '1';
        el.style.transform = 'none';
        io.disconnect();
      }
    });
  }, { threshold: 0.15 });
  io.observe(el);
});
`.trim();

export type PublishPage = {
  slug: string;
  name: string;
  sections: SiteSection[];
  showInNav: boolean;
};

/**
 * Renders every page of the site to its own static HTML file, ready to
 * deploy as-is: the home page becomes index.html and each other page becomes
 * <slug>/index.html, so live URLs stay clean (/about/, /services/) with no
 * routing config needed on Vercel's side.
 *
 * Uses Tailwind's CDN script rather than a precompiled stylesheet - this
 * keeps publishing a pure server-render with no build step for the first
 * version of this pipeline; swapping in a precompiled shared CSS bundle
 * later is a drop-in change that doesn't touch section components at all.
 */
export function renderSiteToStaticFiles(args: {
  pages: PublishPage[];
  theme: ThemeConfig;
  nav: { variant: string; content: NavContent };
  footer: { variant: string; content: FooterContent };
  businessName: string;
}): Record<string, string> {
  const navPages = args.pages.map((p) => ({
    slug: p.slug,
    name: p.name,
    showInNav: p.showInNav,
  }));

  const files: Record<string, string> = {};

  for (const page of args.pages) {
    const bodyHtml = renderToStaticMarkup(
      createElement(SiteRenderer, {
        sections: page.sections,
        theme: args.theme,
        nav: args.nav,
        footer: args.footer,
        pages: navPages,
        currentSlug: page.slug,
        editable: false,
      }),
    );

    const title = page.slug === "" ? args.businessName : `${page.name} — ${args.businessName}`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(args.businessName)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="${googleFontsHref(args.theme)}" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
  :root { ${themeCssVarsString(args.theme)}; }
  html { scroll-behavior: smooth; }
  body { font-family: var(--bp-font-body); margin: 0; }
</style>
</head>
<body>
<div id="site-root">${bodyHtml}</div>
<script>${REVEAL_SCRIPT}</script>
</body>
</html>`;

    files[page.slug === "" ? "index.html" : `${page.slug}/index.html`] = html;
  }

  return files;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
