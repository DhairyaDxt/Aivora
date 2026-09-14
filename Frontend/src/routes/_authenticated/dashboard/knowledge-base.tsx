import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { parseKnowledgeDocument, reembedKnowledgeBase } from "@/lib/knowledge.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Trash2, Upload } from "lucide-react";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";

export const Route = createFileRoute("/_authenticated/dashboard/knowledge-base")({
  head: () => ({
    meta: [
      { title: "Knowledge base — Aivora" },
      {
        name: "description",
        content: "Teach your receptionist about your services, pricing and policies.",
      },
      { property: "og:title", content: "Knowledge base — Aivora" },
      { property: "og:description", content: "Teach your receptionist what your business does." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KnowledgeBase,
});

const TYPES = [
  { value: "service_info", label: "Services and pricing" },
  { value: "policy", label: "Policy" },
  { value: "faq", label: "Question and answer" },
];

function KnowledgeBase() {
  const { data: org } = useOrg();
  const queryClient = useQueryClient();
  const reembed = useServerFn(reembedKnowledgeBase);
  const parseDocument = useServerFn(parseKnowledgeDocument);
  const [type, setType] = useState("faq");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: entries = [] } = useQuery({
    queryKey: ["kb", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base_entries")
        .select("*")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["kb", org?.id] });

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!org) return;
    setBusy(true);
    const { data: inserted, error } = await supabase
      .from("knowledge_base_entries")
      .insert({ org_id: org.id, type, title, content, source: "manual" })
      .select()
      .single();
    if (error) {
      setBusy(false);
      toast.error("Could not save that entry.");
      return;
    }
    setTitle("");
    setContent("");
    refresh();
    toast.success("Saved to your knowledge base.");

    // A manually-typed entry has no embedding yet - nothing else in the
    // system generates one automatically, so it would otherwise never be
    // found by the receptionist's knowledge search.
    try {
      await reembed({ data: { orgId: org.id, entryId: inserted.id } });
      refresh();
    } catch {
      toast.error("Saved, but couldn't index it for search yet. Try again from the list.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("knowledge_base_entries").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete that entry.");
      return;
    }
    refresh();
  };

  const retryEmbedding = async (id: string) => {
    if (!org) return;
    try {
      await reembed({ data: { orgId: org.id, entryId: id } });
      refresh();
      toast.success("Indexed for search.");
    } catch {
      toast.error("Could not index that entry yet.");
    }
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !org) return;
    setUploading(true);
    const path = `${org.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("knowledge-docs").upload(path, file);
    if (uploadError) {
      setUploading(false);
      toast.error("That document could not be uploaded.");
      return;
    }
    try {
      const result = await parseDocument({ data: { orgId: org.id, storagePath: path } });
      toast.success(
        `Read ${file.name} and added ${result.entries_created} knowledge base ${
          result.entries_created === 1 ? "entry" : "entries"
        }.`,
      );
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that document.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="relative overflow-hidden px-6 py-10 md:px-10 md:py-14">
      <AuroraBackground />
      <div className="relative">
        <SectionLabel index={3}>Knowledge base</SectionLabel>
        <h1 className="mt-2 text-3xl font-bold">Knowledge base</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Everything here can be used by your receptionist when it answers a caller.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr]">
          <form onSubmit={add} className="panel h-fit space-y-5 p-6">
            <h2 className="text-lg font-semibold">Add an entry</h2>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-title">{type === "faq" ? "Question" : "Title"}</Label>
              <Input
                id="kb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "faq" ? "Do you offer emergency callouts?" : "Cancellation policy"
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-content">{type === "faq" ? "Answer" : "Details"}</Label>
              <Textarea
                id="kb-content"
                required
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write it the way you'd say it on the phone."
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !content}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Add to knowledge base
            </Button>

            <div className="border-t border-border pt-5">
              <Label htmlFor="kb-doc" className="mb-2 block">
                Upload a document
              </Label>
              <label
                htmlFor="kb-doc"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:bg-secondary"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? "Reading document..." : "Choose a file"}
              </label>
              <input
                id="kb-doc"
                type="file"
                className="hidden"
                onChange={upload}
                disabled={uploading}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                We'll read it and automatically split it into knowledge base entries.
              </p>
            </div>
          </form>

          <div className="panel overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Nothing here yet. Add your first answer on the left.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => {
                    const indexed = Boolean(entry.embedded_at);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {TYPES.find((t) => t.value === entry.type)?.label ?? entry.type}
                        </TableCell>
                        <TableCell className="font-medium">{entry.title ?? "—"}</TableCell>
                        <TableCell className="max-w-md truncate text-muted-foreground">
                          {entry.content}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {indexed ? (
                            "Ready"
                          ) : (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-status-testing"
                              onClick={() => retryEmbedding(entry.id)}
                            >
                              Not indexed — retry
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => remove(entry.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
