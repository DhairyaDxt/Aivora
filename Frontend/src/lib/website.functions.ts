import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FooterContent,
  NavContent,
  SiteSection,
  ThemeConfig,
} from "@/components/website/types";
import { getTemplate, buildPageSections } from "@/components/website/templates";
import { slugify } from "@/lib/aivora";

async function requireServiceAccess(supabase: SupabaseClient, serviceId: string) {
  const { data: service } = await supabase
    .from("services")
    .select("id, org_id, name")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) throw new Error("That website could not be found.");
  return service;
}

/** Picks a template, asks Gemini to personalize its copy from the business's
 * existing profile + knowledge base, and saves the result as a multi-page
 * draft (one website_pages row per page). */
export const createWebsiteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string; templateId: string }) => data)
  .handler(async ({ data, context }) => {
    const service = await requireServiceAccess(context.supabase, data.serviceId);
    const template = getTemplate(data.templateId);
    if (!template) throw new Error("Unknown template.");

    const [{ data: org }, { data: business }, { data: knowledge }] = await Promise.all([
      context.supabase
        .from("organizations")
        .select("name, industry_vertical")
        .eq("id", service.org_id!)
        .maybeSingle(),
      context.supabase
        .from("business_profiles")
        .select("display_name, legal_name, description, address, business_hours")
        .eq("org_id", service.org_id!)
        .maybeSingle(),
      context.supabase
        .from("knowledge_base_entries")
        .select("title, content")
        .eq("org_id", service.org_id!)
        .limit(30),
    ]);

    const businessName =
      business?.display_name || business?.legal_name || org?.name || "Your Business";

    const { applyCopyToSections, generateWebsiteCopyFields } = await import("./website.server");

    let applyCopy = (sections: SiteSection[]) => sections;
    try {
      const copy = await generateWebsiteCopyFields({
        templateId: data.templateId,
        businessName,
        industryVertical: org?.industry_vertical ?? null,
        description: business?.description ?? null,
        knowledge: knowledge ?? [],
      });
      applyCopy = (sections) => applyCopyToSections(sections, copy);
    } catch (error) {
      // AI personalization is a nice-to-have, not a hard requirement - fall
      // back to the template's own default copy rather than blocking the
      // business from getting a draft at all.
      console.error("Website copy generation failed, using template defaults", error);
    }

    const address = business?.address as { line1?: string; city?: string } | null;
    const addressText = address ? [address.line1, address.city].filter(Boolean).join(", ") : "";

    // Factual fields come straight from the business's own data, never AI.
    const withFacts = (sections: SiteSection[]): SiteSection[] =>
      sections.map((section) =>
        section.type === "contactBooking" && addressText
          ? { ...section, content: { ...section.content, address: addressText } }
          : section,
      );

    const { error: configError } = await context.supabase.from("website_configs").upsert(
      {
        service_id: data.serviceId,
        template_id: data.templateId,
        theme: template.theme,
        nav_variant: template.nav.variant,
        nav_content: { ...template.nav.content, businessName },
        footer_variant: template.footer.variant,
        footer_content: { ...template.footer.content, businessName },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service_id" },
    );
    if (configError) throw new Error(configError.message);

    // Replace any previous draft's pages so switching template is a clean slate.
    await context.supabase.from("website_pages").delete().eq("service_id", data.serviceId);

    const { error: pagesError } = await context.supabase.from("website_pages").insert(
      template.pages.map((page, index) => ({
        service_id: data.serviceId,
        slug: page.slug,
        name: page.name,
        sections: withFacts(applyCopy(page.sections)),
        sort_order: index,
        is_home: page.slug === "",
        show_in_nav: true,
      })),
    );
    if (pagesError) throw new Error(pagesError.message);

    return { ok: true as const };
  });

/** Wipes the whole draft - every page plus the site settings - so the
 * business lands back on the template picker with a genuinely clean slate.
 * An already-published site stays live on their Vercel account; we only
 * delete what lives in Aivora. */
export const deleteWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: config } = await supabaseAdmin
      .from("website_configs")
      .select("vercel_token_secret_ref")
      .eq("service_id", data.serviceId)
      .maybeSingle();

    if (config?.vercel_token_secret_ref) {
      await supabaseAdmin.rpc("delete_vercel_secret", {
        p_name: config.vercel_token_secret_ref,
      });
    }

    await supabaseAdmin.from("website_pages").delete().eq("service_id", data.serviceId);
    await supabaseAdmin.from("website_configs").delete().eq("service_id", data.serviceId);

    await context.supabase
      .from("services")
      .update({ status: "draft", deployed_at: null })
      .eq("id", data.serviceId);

    return { ok: true as const };
  });

export const savePageSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string; pageId: string; sections: SiteSection[] }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { error } = await context.supabase
      .from("website_pages")
      .update({ sections: data.sections, updated_at: new Date().toISOString() })
      .eq("id", data.pageId)
      .eq("service_id", data.serviceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      serviceId: string;
      theme: ThemeConfig;
      navContent: NavContent;
      footerContent: FooterContent;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { error } = await context.supabase
      .from("website_configs")
      .update({
        theme: data.theme,
        nav_content: data.navContent,
        footer_content: data.footerContent,
        updated_at: new Date().toISOString(),
      })
      .eq("service_id", data.serviceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const addWebsitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string; name: string; preset: string }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);

    const { data: config } = await context.supabase
      .from("website_configs")
      .select("template_id")
      .eq("service_id", data.serviceId)
      .maybeSingle();
    if (!config) throw new Error("Pick a template first.");

    const { data: existing } = await context.supabase
      .from("website_pages")
      .select("slug, sort_order")
      .eq("service_id", data.serviceId);

    const baseSlug = slugify(data.name) || "page";
    const taken = new Set((existing ?? []).map((p) => p.slug));
    let slug = baseSlug;
    let suffix = 2;
    while (taken.has(slug)) slug = `${baseSlug}-${suffix++}`;

    const nextOrder = Math.max(0, ...(existing ?? []).map((p) => p.sort_order ?? 0)) + 1;

    const { data: page, error } = await context.supabase
      .from("website_pages")
      .insert({
        service_id: data.serviceId,
        slug,
        name: data.name,
        sections: buildPageSections(config.template_id, data.preset),
        sort_order: nextOrder,
        is_home: false,
        show_in_nav: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { ok: true as const, pageId: page.id };
  });

export const updateWebsitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { serviceId: string; pageId: string; name?: string; showInNav?: boolean }) => data,
  )
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { error } = await context.supabase
      .from("website_pages")
      .update({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.showInNav !== undefined ? { show_in_nav: data.showInNav } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.pageId)
      .eq("service_id", data.serviceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteWebsitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string; pageId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);

    const { data: page } = await context.supabase
      .from("website_pages")
      .select("is_home")
      .eq("id", data.pageId)
      .eq("service_id", data.serviceId)
      .maybeSingle();
    if (page?.is_home) throw new Error("The home page can't be deleted.");

    const { error } = await context.supabase
      .from("website_pages")
      .delete()
      .eq("id", data.pageId)
      .eq("service_id", data.serviceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const reorderWebsitePages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string; pageIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    await Promise.all(
      data.pageIds.map((pageId, index) =>
        context.supabase
          .from("website_pages")
          .update({ sort_order: index })
          .eq("id", pageId)
          .eq("service_id", data.serviceId),
      ),
    );
    return { ok: true as const };
  });

export type AssistantResult = {
  reply: string;
  changes: string[];
  /** Set when the assistant wants to delete a page - the UI asks the owner to
   * confirm rather than letting a misread instruction remove a page. */
  pendingDelete: { pageId: string; pageName: string } | null;
  addedPageIds: string[];
};

/** One turn of the in-editor website assistant: reads the saved draft, asks
 * Gemini what to change, applies the resulting operations and persists them.
 * The editor saves before calling this, then reloads after, so the database
 * stays the single source of truth and undo is just "restore the snapshot". */
export const sendWebsiteAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      serviceId: string;
      message: string;
      history: Array<{ role: "user" | "assistant"; text: string }>;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<AssistantResult> => {
    await requireServiceAccess(context.supabase, data.serviceId);

    const [{ data: configRow }, { data: pageRows }] = await Promise.all([
      context.supabase
        .from("website_configs")
        .select("template_id, theme, nav_variant, nav_content, footer_variant, footer_content")
        .eq("service_id", data.serviceId)
        .maybeSingle(),
      context.supabase
        .from("website_pages")
        .select("id, slug, name, sections, show_in_nav, sort_order")
        .eq("service_id", data.serviceId)
        .order("sort_order", { ascending: true }),
    ]);
    if (!configRow) throw new Error("Pick a template first.");

    const { applyOperations } = await import("@/components/website/assistantOps");
    const { runWebsiteAssistantTurn } = await import("./websiteAssistant.server");

    const draft = {
      theme: configRow.theme as unknown as ThemeConfig,
      nav: {
        variant: configRow.nav_variant ?? "simple",
        content: configRow.nav_content as unknown as NavContent,
      },
      footer: {
        variant: configRow.footer_variant ?? "columns",
        content: configRow.footer_content as unknown as FooterContent,
      },
      pages: (pageRows ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        showInNav: row.show_in_nav,
        sections: row.sections as unknown as SiteSection[],
      })),
    };

    const turn = await runWebsiteAssistantTurn({
      draft,
      message: data.message,
      history: data.history,
    });

    const { draft: nextDraft, changes, deferred } = applyOperations(draft, turn.operations);

    // Persist the in-place edits.
    const themeChanged = nextDraft.theme !== draft.theme;
    const navChanged = nextDraft.nav !== draft.nav;
    const footerChanged = nextDraft.footer !== draft.footer;
    if (themeChanged || navChanged || footerChanged) {
      await context.supabase
        .from("website_configs")
        .update({
          theme: nextDraft.theme,
          nav_content: nextDraft.nav.content,
          footer_content: nextDraft.footer.content,
          updated_at: new Date().toISOString(),
        })
        .eq("service_id", data.serviceId);
    }

    // applyOperations rebuilds every page's section array, so compare by value
    // rather than reference to avoid rewriting rows that didn't actually change.
    await Promise.all(
      nextDraft.pages
        .filter((page, index) => {
          const before = draft.pages[index]?.sections;
          return JSON.stringify(before) !== JSON.stringify(page.sections);
        })
        .map((page) =>
          context.supabase
            .from("website_pages")
            .update({ sections: page.sections, updated_at: new Date().toISOString() })
            .eq("id", page.id)
            .eq("service_id", data.serviceId),
        ),
    );

    // Structural operations need their own rows.
    const addedPageIds: string[] = [];
    let pendingDelete: AssistantResult["pendingDelete"] = null;

    for (const operation of deferred) {
      if (operation.op === "add_page") {
        const baseSlug = slugify(operation.name) || "page";
        const taken = new Set(nextDraft.pages.map((p) => p.slug));
        let slug = baseSlug;
        let suffix = 2;
        while (taken.has(slug)) slug = `${baseSlug}-${suffix++}`;

        const { data: created } = await context.supabase
          .from("website_pages")
          .insert({
            service_id: data.serviceId,
            slug,
            name: operation.name,
            sections: buildPageSections(configRow.template_id, operation.preset),
            sort_order: nextDraft.pages.length,
            is_home: false,
            show_in_nav: true,
          })
          .select("id")
          .single();

        if (created) {
          addedPageIds.push(created.id);
          changes.push(`Added the "${operation.name}" page`);
        }
      } else {
        const slug = operation.pageSlug.replace(/^\/|\/$/g, "");
        const target = nextDraft.pages.find((p) => p.slug === slug);
        // The home page can't be deleted, and deletions always go back to the
        // owner to confirm rather than happening on the model's say-so.
        if (target && target.slug !== "") {
          pendingDelete = { pageId: target.id, pageName: target.name };
        }
      }
    }

    return { reply: turn.reply, changes, pendingDelete, addedPageIds };
  });

export type VercelStatus = {
  connected: boolean;
  vercelUsername: string | null;
  deploymentUrl: string | null;
  lastPublishedAt: string | null;
  lastError: string | null;
};

export const getVercelStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }): Promise<VercelStatus> => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { data: row } = await context.supabase
      .from("website_configs")
      .select(
        "connection_status, vercel_project_name, deployment_url, last_published_at, last_error",
      )
      .eq("service_id", data.serviceId)
      .maybeSingle();
    return {
      connected: row?.connection_status === "connected",
      vercelUsername: row?.vercel_project_name ?? null,
      deploymentUrl: row?.deployment_url ?? null,
      lastPublishedAt: row?.last_published_at ?? null,
      lastError: row?.last_error ?? null,
    };
  });

export const connectVercelManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string; accessToken: string }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { getVercelUser } = await import("./website.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let username: string;
    try {
      const user = await getVercelUser(data.accessToken);
      username = user.user.username;
    } catch {
      throw new Error("That doesn't look like a valid Vercel access token.");
    }

    const secretName = `vercel_access_${data.serviceId}`;
    const { error: vaultError } = await supabaseAdmin.rpc("store_vercel_secret", {
      p_name: secretName,
      p_secret: data.accessToken,
    });
    if (vaultError) throw new Error(vaultError.message);

    const { error } = await supabaseAdmin
      .from("website_configs")
      .update({
        vercel_token_secret_ref: secretName,
        connection_status: "connected",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("service_id", data.serviceId);
    if (error) throw new Error(error.message);

    return { ok: true as const, username };
  });

export const disconnectVercel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireServiceAccess(context.supabase, data.serviceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("website_configs")
      .select("vercel_token_secret_ref")
      .eq("service_id", data.serviceId)
      .maybeSingle();

    if (row?.vercel_token_secret_ref) {
      await supabaseAdmin.rpc("delete_vercel_secret", { p_name: row.vercel_token_secret_ref });
    }

    await supabaseAdmin
      .from("website_configs")
      .update({
        vercel_token_secret_ref: null,
        vercel_project_id: null,
        vercel_project_name: null,
        connection_status: "not_connected",
        updated_at: new Date().toISOString(),
      })
      .eq("service_id", data.serviceId);

    return { ok: true as const };
  });

export const publishWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { serviceId: string }) => data)
  .handler(async ({ data, context }) => {
    const service = await requireServiceAccess(context.supabase, data.serviceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { renderSiteToStaticFiles, createDeployment } = await import("./website.server");

    const [{ data: config }, { data: pages }] = await Promise.all([
      supabaseAdmin
        .from("website_configs")
        .select("*")
        .eq("service_id", data.serviceId)
        .maybeSingle(),
      supabaseAdmin
        .from("website_pages")
        .select("id, slug, name, sections, show_in_nav, sort_order")
        .eq("service_id", data.serviceId)
        .order("sort_order", { ascending: true }),
    ]);

    if (!config) throw new Error("Set up your website first.");
    if (!pages?.length) throw new Error("Add at least one page before publishing.");
    if (config.connection_status !== "connected" || !config.vercel_token_secret_ref) {
      throw new Error("Connect your Vercel account first.");
    }

    const { data: tokenData } = await supabaseAdmin.rpc("read_vercel_secret", {
      p_name: config.vercel_token_secret_ref,
    });
    const token = tokenData as string | null;
    if (!token) throw new Error("Connect your Vercel account first.");

    const theme = config.theme as unknown as ThemeConfig;
    const navContent = config.nav_content as unknown as NavContent;
    const footerContent = config.footer_content as unknown as FooterContent;
    const businessName = navContent?.businessName || service.name || "Your Business";

    try {
      const files = renderSiteToStaticFiles({
        pages: pages.map((p) => ({
          slug: p.slug,
          name: p.name,
          sections: p.sections as unknown as SiteSection[],
          showInNav: p.show_in_nav,
        })),
        theme,
        nav: { variant: config.nav_variant ?? "simple", content: navContent },
        footer: { variant: config.footer_variant ?? "columns", content: footerContent },
        businessName,
      });

      const projectName = config.vercel_project_name ?? `aivora-${service.id.slice(0, 8)}`;
      const deployment = await createDeployment(token, { projectName, files });

      await Promise.all([
        supabaseAdmin
          .from("website_configs")
          .update({
            vercel_project_id: deployment.projectId ?? config.vercel_project_id,
            vercel_project_name: projectName,
            deployment_url: `https://${deployment.url}`,
            published_theme: theme,
            last_published_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("service_id", data.serviceId),
        ...pages.map((p) =>
          supabaseAdmin
            .from("website_pages")
            .update({ published_sections: p.sections })
            .eq("id", p.id),
        ),
      ]);

      await context.supabase
        .from("services")
        .update({ status: "live", deployed_at: new Date().toISOString() })
        .eq("id", data.serviceId);

      return { ok: true as const, url: `https://${deployment.url}`, pageCount: pages.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish your website.";
      await supabaseAdmin
        .from("website_configs")
        .update({ last_error: message })
        .eq("service_id", data.serviceId);
      throw new Error(message);
    }
  });
