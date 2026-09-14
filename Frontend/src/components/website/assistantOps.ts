// The vocabulary the website assistant speaks. Gemini can only ever emit one
// of these operations (they're exposed to it as function declarations), and
// applyOperations is the only thing that mutates a draft - so an odd model
// response can produce a no-op or a rejected edit, never a malformed site.
import type { FooterContent, NavContent, SiteSection, ThemeConfig } from "./types";

export type AssistantDraft = {
  theme: ThemeConfig;
  nav: { variant: string; content: NavContent };
  footer: { variant: string; content: FooterContent };
  pages: Array<{
    id: string;
    slug: string;
    name: string;
    showInNav: boolean;
    sections: SiteSection[];
  }>;
};

export type AssistantOperation =
  | {
      op: "update_section_content";
      pageSlug: string;
      sectionId: string;
      fields: Record<string, unknown>;
    }
  | { op: "set_theme"; fields: Partial<ThemeConfig> }
  | { op: "reorder_sections"; pageSlug: string; sectionIds: string[] }
  | { op: "set_section_visible"; pageSlug: string; sectionId: string; visible: boolean }
  | { op: "update_nav"; fields: Partial<NavContent> }
  | { op: "update_footer"; fields: Partial<FooterContent> }
  | { op: "add_page"; name: string; preset: string }
  | { op: "delete_page"; pageSlug: string };

/** Operations that need their own database round-trip (page rows), handled by
 * the caller rather than by the pure draft transform below. */
export type DeferredOperation = Extract<AssistantOperation, { op: "add_page" | "delete_page" }>;

export type ApplyResult = {
  draft: AssistantDraft;
  changes: string[];
  deferred: DeferredOperation[];
};

const THEME_KEYS: Array<keyof ThemeConfig> = [
  "primaryColor",
  "accentColor",
  "fontHeading",
  "fontBody",
  "radius",
];

function findPage(draft: AssistantDraft, slug: string) {
  // Models tend to say "home" for the page whose slug is actually "".
  const normalized = slug === "home" || slug === "/" ? "" : slug.replace(/^\/|\/$/g, "");
  return draft.pages.find((p) => p.slug === normalized);
}

/** Applies a batch of operations to a draft, returning a new draft plus a
 * plain-language list of what changed (shown to the user in the chat). */
export function applyOperations(
  draft: AssistantDraft,
  operations: AssistantOperation[],
): ApplyResult {
  let next: AssistantDraft = {
    ...draft,
    pages: draft.pages.map((p) => ({ ...p, sections: [...p.sections] })),
  };
  const changes: string[] = [];
  const deferred: DeferredOperation[] = [];

  for (const operation of operations) {
    switch (operation.op) {
      case "update_section_content": {
        const page = findPage(next, operation.pageSlug);
        const section = page?.sections.find((s) => s.id === operation.sectionId);
        if (!page || !section) break;
        const fields = Object.fromEntries(
          Object.entries(operation.fields).filter(([, v]) => v !== undefined && v !== null),
        );
        if (Object.keys(fields).length === 0) break;
        page.sections = page.sections.map((s) =>
          s.id === operation.sectionId
            ? ({ ...s, content: { ...s.content, ...fields } } as SiteSection)
            : s,
        );
        changes.push(`Updated the ${section.type} section on ${page.name}`);
        break;
      }

      case "set_theme": {
        const fields: Partial<ThemeConfig> = {};
        for (const key of THEME_KEYS) {
          const value = operation.fields[key];
          if (typeof value === "string") {
            (fields as Record<string, string>)[key] = value;
          }
        }
        if (Object.keys(fields).length === 0) break;
        next = { ...next, theme: { ...next.theme, ...fields } };
        changes.push(`Changed ${Object.keys(fields).join(", ")}`);
        break;
      }

      case "reorder_sections": {
        const page = findPage(next, operation.pageSlug);
        if (!page) break;
        const byId = new Map(page.sections.map((s) => [s.id, s]));
        const reordered = operation.sectionIds
          .map((id) => byId.get(id))
          .filter((s): s is SiteSection => Boolean(s));
        // Anything the model forgot to mention keeps its place at the end,
        // so a partial list can never silently drop sections.
        const missing = page.sections.filter((s) => !operation.sectionIds.includes(s.id));
        if (reordered.length === 0) break;
        page.sections = [...reordered, ...missing];
        changes.push(`Reordered sections on ${page.name}`);
        break;
      }

      case "set_section_visible": {
        const page = findPage(next, operation.pageSlug);
        const section = page?.sections.find((s) => s.id === operation.sectionId);
        if (!page || !section) break;
        page.sections = page.sections.map((s) =>
          s.id === operation.sectionId ? { ...s, visible: operation.visible } : s,
        );
        changes.push(
          `${operation.visible ? "Showed" : "Hid"} the ${section.type} section on ${page.name}`,
        );
        break;
      }

      case "update_nav": {
        next = {
          ...next,
          nav: { ...next.nav, content: { ...next.nav.content, ...operation.fields } },
        };
        changes.push("Updated the navigation bar");
        break;
      }

      case "update_footer": {
        next = {
          ...next,
          footer: { ...next.footer, content: { ...next.footer.content, ...operation.fields } },
        };
        changes.push("Updated the footer");
        break;
      }

      case "add_page":
      case "delete_page":
        deferred.push(operation);
        break;
    }
  }

  return { draft: next, changes, deferred };
}

/** A compact view of the site for the model's context - full section content
 * would blow up the prompt, so text fields are truncated and images dropped. */
export function summarizeDraft(draft: AssistantDraft): string {
  const lines: string[] = [
    `Theme: primaryColor=${draft.theme.primaryColor}, accentColor=${draft.theme.accentColor}, fontHeading=${draft.theme.fontHeading}, fontBody=${draft.theme.fontBody}, radius=${draft.theme.radius}`,
    `Nav: businessName="${draft.nav.content.businessName}", ctaText="${draft.nav.content.ctaText ?? ""}"`,
    `Footer: tagline="${draft.footer.content.tagline ?? ""}"`,
    "",
    "Pages:",
  ];

  for (const page of draft.pages) {
    lines.push(`- "${page.name}" (pageSlug: "${page.slug}")`);
    for (const section of page.sections) {
      const content = section.content as Record<string, unknown>;
      const preview = Object.entries(content)
        .filter(([key, value]) => typeof value === "string" && !/image/i.test(key))
        .map(([key, value]) => `${key}="${truncate(String(value), 80)}"`)
        .join(", ");
      lines.push(
        `    · sectionId="${section.id}" type=${section.type}${section.visible ? "" : " (hidden)"}${
          preview ? ` ${preview}` : ""
        }`,
      );
    }
  }

  return lines.join("\n");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
