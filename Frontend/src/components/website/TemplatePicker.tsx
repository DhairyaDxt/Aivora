import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  searchTemplates,
  sortedTemplatesFor,
  templateIndustries,
  type TemplateDef,
} from "./templates";

export function TemplatePicker({
  industryVertical,
  onSelect,
}: {
  industryVertical: string | null | undefined;
  onSelect: (templateId: string) => Promise<void>;
}) {
  const [selecting, setSelecting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState<string | null>(industryVertical ?? null);

  const industries = useMemo(() => templateIndustries(), []);

  const visible = useMemo(() => {
    const base = sortedTemplatesFor(industryVertical);
    const byIndustry = industry ? base.filter((t) => t.bestFor.includes(industry)) : base;
    return searchTemplates(byIndustry, query);
  }, [industryVertical, industry, query]);

  const pick = async (template: TemplateDef) => {
    setSelecting(template.id);
    try {
      await onSelect(template.id);
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold">Choose a starting point</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Every template is a full multi-page site. We'll personalize the copy from your business
        info, and you can change pages, colors, fonts and content afterward.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates (salon, menu, gym…)"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIndustry(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              industry === null
                ? "border-[var(--grad-to)] bg-[var(--grad-to)]/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {industries.map((item) => (
            <button
              key={item}
              onClick={() => setIndustry(item === industry ? null : item)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                industry === item
                  ? "border-[var(--grad-to)] bg-[var(--grad-to)]/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No templates match that search. Try a different word, or clear the filter.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((template) => (
            <div key={template.id} className="flex flex-col overflow-hidden rounded-xl border">
              <img
                src={template.previewImage}
                alt={template.name}
                className="aspect-4/3 w-full object-cover"
              />
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold">{template.name}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{template.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {template.pages.length} pages · {template.pages.map((p) => p.name).join(" · ")}
                </p>
                <Button
                  className="mt-4 w-full"
                  onClick={() => pick(template)}
                  disabled={selecting !== null}
                >
                  {selecting === template.id ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  {selecting === template.id ? "Personalizing…" : "Use this template"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
