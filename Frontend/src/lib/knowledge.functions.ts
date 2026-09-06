import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

const RAG_SERVICE_URL_DEFAULT = "http://localhost:8001";

type ParseResult = {
  success: boolean;
  error?: string;
  entries_created?: number;
  entries?: Array<{ id: string; title: string | null; type: string }>;
};

type ReembedResult = {
  processed: number;
  failed: number;
  entries: Array<{ id: string; title: string | null; status: string }>;
};

async function requireOrgMembership(supabase: SupabaseClient, orgId: string): Promise<void> {
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!membership) throw new Error("You do not have access to this business.");
}

async function ragFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const secret = process.env["ORCHESTRATION_SHARED_SECRET"];
  if (!secret) throw new Error("The knowledge extraction service is not configured yet.");
  const ragUrl = process.env["RAG_SERVICE_URL"] ?? RAG_SERVICE_URL_DEFAULT;

  const res = await fetch(`${ragUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`RAG service error (${path})`, res.status, text);
    throw new Error(`The knowledge extraction service rejected the request (${res.status}).`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Sends one big block of pasted business info to the RAG service, which uses an
 *  LLM to split it into structured, already-embedded knowledge-base entries. */
export const parseKnowledgeText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; text: string }) => data)
  .handler(async ({ data, context }) => {
    if (data.text.trim().length < 50) {
      throw new Error("Write a bit more about the business before submitting.");
    }
    await requireOrgMembership(context.supabase, data.orgId);

    const parsed = await ragFetch<ParseResult>("/v1/kb/parse-text", {
      org_id: data.orgId,
      text: data.text,
    });
    if (!parsed.success) {
      throw new Error(parsed.error ?? "Could not extract knowledge from that text.");
    }
    return parsed as Required<Pick<ParseResult, "entries_created" | "entries">>;
  });

/** Downloads an uploaded document from storage, extracts its text, and uses an
 *  LLM to split it into structured, already-embedded knowledge-base entries. */
export const parseKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; storagePath: string }) => data)
  .handler(async ({ data, context }) => {
    await requireOrgMembership(context.supabase, data.orgId);

    const parsed = await ragFetch<ParseResult>("/v1/kb/parse-document", {
      org_id: data.orgId,
      storage_path: data.storagePath,
    });
    if (!parsed.success) {
      throw new Error(parsed.error ?? "Could not extract knowledge from that document.");
    }
    return parsed as Required<Pick<ParseResult, "entries_created" | "entries">>;
  });

/** Embeds knowledge base entries that don't have an embedding yet (or one
 *  specific entry), making them searchable by the voice receptionist. */
export const reembedKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; entryId?: string }) => data)
  .handler(async ({ data, context }) => {
    await requireOrgMembership(context.supabase, data.orgId);

    return ragFetch<ReembedResult>("/v1/kb/reembed", {
      org_id: data.orgId,
      entry_id: data.entryId,
    });
  });
