import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PagesPanel } from "./PagesPanel";
import { SectionsPanel } from "./SectionsPanel";
import { ThemePanel } from "./ThemePanel";
import { TemplatePicker } from "./TemplatePicker";
import { ImagePickerSheet } from "./ImagePickerSheet";
import { ConnectVercelCard } from "./tabs/ConnectVercelCard";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AssistantBar, type AssistantMessage } from "./AssistantBar";
import {
  addWebsitePage,
  createWebsiteDraft,
  deleteWebsite,
  deleteWebsitePage,
  publishWebsite,
  reorderWebsitePages,
  savePageSections,
  saveSiteSettings,
  sendWebsiteAssistantMessage,
  updateWebsitePage,
} from "@/lib/website.functions";
import type { FooterContent, NavContent, SitePage, SiteSection, ThemeConfig } from "./types";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";

type SiteConfig = {
  templateId: string;
  theme: ThemeConfig;
  nav: { variant: string; content: NavContent };
  footer: { variant: string; content: FooterContent };
  deploymentUrl: string | null;
};

function setNestedField(
  content: Record<string, unknown>,
  field: string,
  value: string,
): Record<string, unknown> {
  const parts = field.split(".");
  if (parts.length === 1) return { ...content, [parts[0]!]: value };
  const [key, indexStr] = parts as [string, string];
  const index = Number(indexStr);
  const arr = [...((content[key] as string[] | undefined) ?? [])];
  arr[index] = value;
  return { ...content, [key]: arr };
}

export function WebsiteBuilder() {
  const { serviceId } = useParams({ from: "/_authenticated/dashboard/website/$serviceId" });
  const { data: org } = useOrg();

  const createDraft = useServerFn(createWebsiteDraft);
  const savePage = useServerFn(savePageSections);
  const saveSettings = useServerFn(saveSiteSettings);
  const addPageFn = useServerFn(addWebsitePage);
  const updatePageFn = useServerFn(updateWebsitePage);
  const deletePageFn = useServerFn(deleteWebsitePage);
  const reorderPagesFn = useServerFn(reorderWebsitePages);
  const deleteSiteFn = useServerFn(deleteWebsite);
  const askAssistant = useServerFn(sendWebsiteAssistantMessage);
  const publish = useServerFn(publishWebsite);

  const [config, setConfig] = useState<SiteConfig | null | undefined>(undefined);
  const [pages, setPages] = useState<SitePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imagePicker, setImagePicker] = useState<{ sectionId: string; field: string } | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  /** Draft as it was before the assistant's last turn, for one-click undo. */
  const [undoSnapshot, setUndoSnapshot] = useState<{
    config: SiteConfig;
    pages: SitePage[];
    addedPageIds: string[];
  } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const selectedPage = useMemo(
    () => pages.find((p) => p.id === selectedPageId) ?? pages[0] ?? null,
    [pages, selectedPageId],
  );

  const loadSite = useCallback(async () => {
    const [{ data: configRow }, { data: pageRows }] = await Promise.all([
      supabase
        .from("website_configs")
        .select(
          "template_id, theme, nav_variant, nav_content, footer_variant, footer_content, deployment_url",
        )
        .eq("service_id", serviceId)
        .maybeSingle(),
      supabase
        .from("website_pages")
        .select("id, slug, name, sections, sort_order, is_home, show_in_nav")
        .eq("service_id", serviceId)
        .order("sort_order", { ascending: true }),
    ]);

    if (!configRow) {
      setConfig(null);
      return;
    }

    // Header/footer only became site-level when multi-page landed, so a draft
    // created before that has empty objects here - fill them in rather than
    // rendering a nav with no business name.
    const fallbackName = org?.name ?? "Your Business";
    const navContent = configRow.nav_content as unknown as NavContent | null;
    const footerContent = configRow.footer_content as unknown as FooterContent | null;

    setConfig({
      templateId: configRow.template_id,
      theme: configRow.theme as unknown as ThemeConfig,
      nav: {
        variant: configRow.nav_variant ?? "simple",
        content: navContent?.businessName
          ? navContent
          : { businessName: fallbackName, ctaText: "Get in touch", ctaLink: "/contact/" },
      },
      footer: {
        variant: configRow.footer_variant ?? "columns",
        content: footerContent?.businessName
          ? footerContent
          : { businessName: fallbackName, links: [{ label: "Home", href: "/" }] },
      },
      deploymentUrl: configRow.deployment_url,
    });

    const mapped: SitePage[] = (pageRows ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      // Footers became site-level with multi-page, so a footer left inside a
      // page's own sections (from a pre-multi-page draft) would render twice.
      sections: (row.sections as unknown as SiteSection[]).filter((s) => s.type !== "footer"),
      sortOrder: row.sort_order,
      isHome: row.is_home,
      showInNav: row.show_in_nav,
    }));
    setPages(mapped);
    setSelectedPageId((current) =>
      current && mapped.some((p) => p.id === current) ? current : (mapped[0]?.id ?? null),
    );
  }, [serviceId, org?.name]);

  useEffect(() => {
    void loadSite();
  }, [loadSite]);

  // Push the current page into the iframe whenever anything changes, once the
  // frame has signaled it's mounted and ready to receive it.
  useEffect(() => {
    if (!frameReady || !config || !selectedPage) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "aivora-site-update",
        sections: selectedPage.sections,
        theme: config.theme,
        nav: config.nav,
        footer: config.footer,
        pages: pages.map((p) => ({ slug: p.slug, name: p.name, showInNav: p.showInNav })),
        currentSlug: selectedPage.slug,
      },
      window.location.origin,
    );
  }, [frameReady, config, selectedPage, pages]);

  // The message listener below is registered once, so it reads the selected
  // page through a ref rather than closing over a stale state value.
  const selectedPageIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedPageIdRef.current = selectedPage?.id ?? null;
  }, [selectedPage]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as
        | { type: "aivora-site-ready" }
        | { type: "aivora-section-change"; sectionId: string; content: unknown }
        | { type: "aivora-pick-image"; sectionId: string; field: string }
        | { type: "aivora-nav-change"; content: NavContent }
        | { type: "aivora-footer-change"; content: FooterContent }
        | { type: "aivora-navigate"; slug: string }
        | undefined;
      if (!msg) return;

      if (msg.type === "aivora-site-ready") {
        setFrameReady(true);
      } else if (msg.type === "aivora-section-change") {
        const pageId = selectedPageIdRef.current;
        if (!pageId) return;
        setPages((current) =>
          current.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  sections: page.sections.map((s) =>
                    s.id === msg.sectionId ? { ...s, content: msg.content as never } : s,
                  ),
                }
              : page,
          ),
        );
      } else if (msg.type === "aivora-pick-image") {
        setImagePicker({ sectionId: msg.sectionId, field: msg.field });
      } else if (msg.type === "aivora-nav-change") {
        setConfig((c) => (c ? { ...c, nav: { ...c.nav, content: msg.content } } : c));
      } else if (msg.type === "aivora-footer-change") {
        setConfig((c) => (c ? { ...c, footer: { ...c.footer, content: msg.content } } : c));
      } else if (msg.type === "aivora-navigate") {
        setPages((current) => {
          const target = current.find((p) => p.slug === msg.slug);
          if (target) setSelectedPageId(target.id);
          return current;
        });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const selectTemplate = async (templateId: string) => {
    try {
      await createDraft({ data: { serviceId, templateId } });
      toast.success("Your site is ready — personalized with AI from your business info.");
      setShowPicker(false);
      await loadSite();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create your website.");
    }
  };

  const persist = async () => {
    if (!config) return;
    await Promise.all([
      saveSettings({
        data: {
          serviceId,
          theme: config.theme,
          navContent: config.nav.content,
          footerContent: config.footer.content,
        },
      }),
      ...pages.map((page) =>
        savePage({ data: { serviceId, pageId: page.id, sections: page.sections } }),
      ),
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persist();
      toast.success("Saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    setPublishing(true);
    try {
      await persist();
      const result = await publish({ data: { serviceId } });
      toast.success(`Published ${result.pageCount} pages.`);
      setConfig((c) => (c ? { ...c, deploymentUrl: result.url } : c));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish your website.");
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const handleAssistantSend = async (message: string) => {
    if (!config) return;
    setAssistantMessages((current) => [...current, { role: "user", text: message }]);
    setAssistantBusy(true);

    // Snapshot first so Undo can restore exactly what was there, and save any
    // unsaved manual edits so the assistant reads the same site you can see.
    const snapshot = { config, pages, addedPageIds: [] as string[] };

    try {
      await persist();
      const history = assistantMessages.map((m) => ({ role: m.role, text: m.text }));
      const result = await askAssistant({ data: { serviceId, message, history } });

      await loadSite();
      setUndoSnapshot(
        result.changes.length > 0 || result.addedPageIds.length > 0
          ? { ...snapshot, addedPageIds: result.addedPageIds }
          : null,
      );
      setAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.reply,
          changes: result.changes,
          canUndo: result.changes.length > 0 || result.addedPageIds.length > 0,
          pendingDelete: result.pendingDelete,
        },
      ]);
    } catch (error) {
      setAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Something went wrong.",
        },
      ]);
    } finally {
      setAssistantBusy(false);
    }
  };

  const handleAssistantUndo = async () => {
    if (!undoSnapshot) return;
    setAssistantBusy(true);
    try {
      // Pages the assistant created have no "before" state - remove them.
      await Promise.all(
        undoSnapshot.addedPageIds.map((pageId) => deletePageFn({ data: { serviceId, pageId } })),
      );
      await Promise.all([
        saveSettings({
          data: {
            serviceId,
            theme: undoSnapshot.config.theme,
            navContent: undoSnapshot.config.nav.content,
            footerContent: undoSnapshot.config.footer.content,
          },
        }),
        ...undoSnapshot.pages.map((page) =>
          savePage({ data: { serviceId, pageId: page.id, sections: page.sections } }),
        ),
      ]);
      await loadSite();
      setUndoSnapshot(null);
      setAssistantMessages((current) => [
        ...current,
        { role: "assistant", text: "Reverted those changes." },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not undo those changes.");
    } finally {
      setAssistantBusy(false);
    }
  };

  const handleAssistantConfirmDelete = async (pageId: string) => {
    setAssistantBusy(true);
    try {
      await deletePageFn({ data: { serviceId, pageId } });
      await loadSite();
      setAssistantMessages((current) => [
        ...current.map((m) => ({ ...m, pendingDelete: null })),
        { role: "assistant", text: "Page deleted." },
      ]);
      setUndoSnapshot(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that page.");
    } finally {
      setAssistantBusy(false);
    }
  };

  const dismissAssistantDelete = () => {
    setAssistantMessages((current) => [
      ...current.map((m) => ({ ...m, pendingDelete: null })),
      { role: "assistant", text: "Left it as it is." },
    ]);
  };

  const handleDeleteSite = async () => {
    setSaving(true);
    try {
      await deleteSiteFn({ data: { serviceId } });
      setConfirmDelete(false);
      setShowPicker(false);
      setPages([]);
      setSelectedPageId(null);
      setConfig(null);
      toast.success("Website deleted. Pick a template to start fresh.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the website.");
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedSections = (sections: SiteSection[]) => {
    if (!selectedPage) return;
    setPages((current) => current.map((p) => (p.id === selectedPage.id ? { ...p, sections } : p)));
  };

  const pickImage = (url: string) => {
    if (!imagePicker || !selectedPage) return;
    updateSelectedSections(
      selectedPage.sections.map((s) =>
        s.id === imagePicker.sectionId
          ? { ...s, content: setNestedField(s.content as never, imagePicker.field, url) as never }
          : s,
      ),
    );
  };

  const addPage = async (name: string, preset: string) => {
    try {
      const result = await addPageFn({ data: { serviceId, name, preset } });
      await loadSite();
      setSelectedPageId(result.pageId);
      toast.success(`Added "${name}".`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add that page.");
    }
  };

  const removePage = async (pageId: string) => {
    try {
      await deletePageFn({ data: { serviceId, pageId } });
      await loadSite();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that page.");
    }
  };

  const toggleNav = async (pageId: string, showInNav: boolean) => {
    setPages((current) => current.map((p) => (p.id === pageId ? { ...p, showInNav } : p)));
    try {
      await updatePageFn({ data: { serviceId, pageId, showInNav } });
    } catch {
      void loadSite();
    }
  };

  const reorder = async (pageIds: string[]) => {
    setPages((current) =>
      pageIds.map((id, index) => {
        const page = current.find((p) => p.id === id)!;
        return { ...page, sortOrder: index };
      }),
    );
    try {
      await reorderPagesFn({ data: { serviceId, pageIds } });
    } catch {
      void loadSite();
    }
  };

  if (config === undefined) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="relative mx-auto flex h-full max-w-7xl flex-col space-y-4 overflow-hidden p-8">
      <AuroraBackground />
      <div className="relative flex items-center justify-between">
        <div>
          <SectionLabel index={4}>Website builder</SectionLabel>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Website</h1>
          <p className="text-sm text-muted-foreground">
            {config
              ? `${pages.length} page${pages.length === 1 ? "" : "s"} · edit and publish your site.`
              : "Pick a template to get started."}
          </p>
        </div>
        {config ? (
          <div className="flex items-center gap-2">
            {config.deploymentUrl ? (
              <a
                href={config.deploymentUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-[var(--grad-to)] hover:underline"
              >
                View live <ExternalLink className="size-3.5" />
              </a>
            ) : null}
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              <Trash2 className="mr-1.5 size-4" />
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setShowPicker((v) => !v)} disabled={saving}>
              {showPicker ? "Back to editor" : "Change template"}
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving && !publishing ? "Saving..." : "Save"}
            </Button>
            <Button onClick={handlePublish} disabled={saving}>
              {publishing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Publish
            </Button>
          </div>
        ) : null}
      </div>

      {!config || showPicker ? (
        <div className="glass relative flex-1 overflow-y-auto p-6">
          {showPicker ? (
            <p className="mb-4 rounded-lg border border-status-attention/30 bg-status-attention/10 px-3 py-2 text-sm text-status-attention">
              Switching template replaces every page and its content with the new template's.
            </p>
          ) : null}
          <TemplatePicker industryVertical={org?.industry_vertical} onSelect={selectTemplate} />
        </div>
      ) : (
        <Tabs defaultValue="editor" className="relative flex flex-1 flex-col overflow-hidden">
          <TabsList className="w-fit">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="connect">Connect</TabsTrigger>
          </TabsList>
          <div className="glass mt-4 flex-1 overflow-hidden p-6">
            <TabsContent
              value="editor"
              className="m-0 grid h-full grid-cols-1 gap-6 overflow-y-auto lg:grid-cols-[300px_1fr]"
            >
              <div className="space-y-8 overflow-y-auto pr-2">
                <PagesPanel
                  pages={pages}
                  selectedPageId={selectedPage?.id ?? null}
                  onSelect={setSelectedPageId}
                  onReorder={reorder}
                  onToggleNav={toggleNav}
                  onDelete={removePage}
                  onAdd={addPage}
                />
                {selectedPage ? (
                  <SectionsPanel
                    sections={selectedPage.sections}
                    onChange={updateSelectedSections}
                  />
                ) : null}
                <ThemePanel
                  theme={config.theme}
                  onChange={(theme) => setConfig((c) => (c ? { ...c, theme } : c))}
                />
              </div>
              <div className="flex min-h-[640px] flex-col gap-3">
                <div className="flex-1 overflow-hidden rounded-lg border bg-white">
                  <iframe
                    ref={iframeRef}
                    src="/site-frame"
                    title="Website preview"
                    className="size-full min-h-[480px]"
                    onLoad={() => setFrameReady(false)}
                  />
                </div>
                <AssistantBar
                  messages={assistantMessages}
                  busy={assistantBusy}
                  onSend={handleAssistantSend}
                  onUndo={handleAssistantUndo}
                  onConfirmDelete={handleAssistantConfirmDelete}
                  onDismissDelete={dismissAssistantDelete}
                />
              </div>
            </TabsContent>
            <TabsContent value="connect" className="m-0 h-full overflow-y-auto">
              <ConnectVercelCard serviceId={serviceId} />
            </TabsContent>
          </div>
        </Tabs>
      )}

      {org?.id ? (
        <ImagePickerSheet
          open={imagePicker !== null}
          onOpenChange={(open) => !open && setImagePicker(null)}
          orgId={org.id}
          onPick={pickImage}
        />
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this website?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every page, your content and your theme, and disconnects
              Vercel — you'll start again from the template picker. This can't be undone.
              {config?.deploymentUrl
                ? " Your already-published site stays online until you remove it from your Vercel account."
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteSite();
              }}
              disabled={saving}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Delete website
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
