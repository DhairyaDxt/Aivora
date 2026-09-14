import { Plus, X } from "lucide-react";
import { EditableText } from "../Editable";
import type { FooterContent } from "../types";
import type { SectionProps } from "./Hero";

function useLinkHelpers(content: FooterContent, onChange: (c: FooterContent) => void) {
  const links = content.links ?? [];
  const updateLink = (index: number, patch: Partial<{ label: string; href: string }>) =>
    onChange({ ...content, links: links.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  const addLink = () => onChange({ ...content, links: [...links, { label: "Link", href: "#" }] });
  const removeLink = (index: number) =>
    onChange({ ...content, links: links.filter((_, i) => i !== index) });
  return { links, updateLink, addLink, removeLink };
}

export function FooterSimple(props: SectionProps<FooterContent>) {
  const { content, editable, onChange } = props;
  const { links, updateLink, addLink, removeLink } = useLinkHelpers(content, onChange);
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <EditableText
          value={content.businessName}
          onChange={(v) => onChange({ ...content, businessName: v })}
          editable={editable}
          className="text-sm font-semibold text-neutral-900"
          style={{ fontFamily: "var(--bp-font-heading)" }}
        />
        <div className="flex flex-wrap items-center gap-4">
          {links.map((link, i) => (
            <span key={i} className="group inline-flex items-center gap-1">
              <a
                href={link.href}
                className="text-sm text-neutral-500 hover:text-[var(--bp-primary)]"
              >
                <EditableText
                  value={link.label}
                  onChange={(v) => updateLink(i, { label: v })}
                  editable={editable}
                />
              </a>
              {editable ? (
                <button
                  onClick={() => removeLink(i)}
                  className="text-neutral-300 hover:text-neutral-500"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </span>
          ))}
          {editable ? (
            <button onClick={addLink} className="text-neutral-400 hover:text-[var(--bp-primary)]">
              <Plus className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

export function FooterColumns(props: SectionProps<FooterContent>) {
  const { content, editable, onChange } = props;
  const { links, updateLink, addLink, removeLink } = useLinkHelpers(content, onChange);
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <EditableText
              value={content.businessName}
              onChange={(v) => onChange({ ...content, businessName: v })}
              editable={editable}
              className="text-lg font-semibold text-neutral-900"
              style={{ fontFamily: "var(--bp-font-heading)" }}
            />
            {content.tagline || editable ? (
              <EditableText
                as="p"
                value={content.tagline ?? ""}
                onChange={(v) => onChange({ ...content, tagline: v })}
                editable={editable}
                placeholder="A short tagline about your business"
                className="mt-2 max-w-sm text-sm text-neutral-500"
              />
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {links.map((link, i) => (
              <span key={i} className="group inline-flex items-center gap-1">
                <a
                  href={link.href}
                  className="text-sm text-neutral-600 hover:text-[var(--bp-primary)]"
                >
                  <EditableText
                    value={link.label}
                    onChange={(v) => updateLink(i, { label: v })}
                    editable={editable}
                  />
                </a>
                {editable ? (
                  <button
                    onClick={() => removeLink(i)}
                    className="text-neutral-300 hover:text-neutral-500"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </span>
            ))}
            {editable ? (
              <button
                onClick={addLink}
                className="flex items-center gap-1 text-sm text-neutral-400 hover:text-[var(--bp-primary)]"
              >
                <Plus className="size-3.5" /> Add link
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-10 text-xs text-neutral-400">
          © {new Date().getFullYear()} {content.businessName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
