import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteRenderer } from "@/components/website/SiteRenderer";
import type {
  FooterContent,
  NavContent,
  SiteSection,
  SitePage,
  ThemeConfig,
} from "@/components/website/types";

export const Route = createFileRoute("/site-frame")({
  head: () => ({
    meta: [{ title: "Preview" }],
  }),
  component: SiteFrame,
});

type FramePayload = {
  sections: SiteSection[];
  theme: ThemeConfig;
  nav: { variant: string; content: NavContent };
  footer: { variant: string; content: FooterContent };
  pages: Array<Pick<SitePage, "slug" | "name" | "showInNav">>;
  currentSlug: string;
};

type InboundMessage = { type: "aivora-site-update" } & FramePayload;

/**
 * Bare shell with no dashboard chrome and no data-fetching of its own - the
 * parent editor page posts the current draft in via postMessage after this
 * frame signals it's ready, and reads edits back the same way. Keeping this
 * route free of auth/queries is what makes the iframe pattern simple: it's
 * just a renderer, the parent owns all state.
 */
function SiteFrame() {
  const [data, setData] = useState<FramePayload | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as InboundMessage | undefined;
      if (msg?.type !== "aivora-site-update") return;
      const { type: _type, ...payload } = msg;
      setData(payload);
    }
    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "aivora-site-ready" }, window.location.origin);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!data) return null;

  const post = (message: Record<string, unknown>) =>
    window.parent.postMessage(message, window.location.origin);

  return (
    <SiteRenderer
      sections={data.sections}
      theme={data.theme}
      nav={data.nav}
      footer={data.footer}
      pages={data.pages}
      currentSlug={data.currentSlug}
      editable
      onSectionChange={(sectionId, content) =>
        post({ type: "aivora-section-change", sectionId, content })
      }
      onPickImage={(sectionId, field) => post({ type: "aivora-pick-image", sectionId, field })}
      onNavChange={(content) => post({ type: "aivora-nav-change", content })}
      onFooterChange={(content) => post({ type: "aivora-footer-change", content })}
      onNavigate={(slug) => post({ type: "aivora-navigate", slug })}
    />
  );
}
