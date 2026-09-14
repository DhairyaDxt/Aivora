import { EditableText } from "../Editable";
import type { NavContent, SitePage } from "../types";

type NavProps = {
  content: NavContent;
  variant: string;
  editable: boolean;
  onChange: (content: NavContent) => void;
  pages: Array<Pick<SitePage, "slug" | "name" | "showInNav">>;
  currentSlug: string;
  /** In the editor, clicking a nav link switches the page being edited
   * instead of navigating the iframe away to a URL that doesn't exist yet. */
  onNavigate?: (slug: string) => void;
};

function pageHref(slug: string) {
  return slug === "" ? "/" : `/${slug}/`;
}

export function Navbar({
  content,
  variant,
  editable,
  onChange,
  pages,
  currentSlug,
  onNavigate,
}: NavProps) {
  const navPages = pages.filter((p) => p.showInNav);
  const centered = variant === "centered";

  const links = navPages.map((page) => {
    const active = page.slug === currentSlug;
    return (
      <a
        key={page.slug}
        href={pageHref(page.slug)}
        onClick={
          onNavigate
            ? (e) => {
                e.preventDefault();
                onNavigate(page.slug);
              }
            : undefined
        }
        className={
          active
            ? "text-sm font-semibold text-[var(--bp-primary)]"
            : "text-sm text-neutral-600 transition-colors hover:text-[var(--bp-primary)]"
        }
      >
        {page.name}
      </a>
    );
  });

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md">
      <div
        className={
          centered
            ? "mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-4"
            : "mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4"
        }
      >
        <EditableText
          value={content.businessName}
          onChange={(v) => onChange({ ...content, businessName: v })}
          editable={editable}
          className="text-lg font-bold text-neutral-900"
          style={{ fontFamily: "var(--bp-font-heading)" }}
        />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {links}
          {content.ctaText ? (
            <a
              href={content.ctaLink ?? "#contact"}
              className="bg-[var(--bp-primary)] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
              style={{ borderRadius: "var(--bp-radius)" }}
            >
              <EditableText
                value={content.ctaText}
                onChange={(v) => onChange({ ...content, ctaText: v })}
                editable={editable}
              />
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
