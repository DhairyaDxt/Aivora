import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { COUNTRIES, LANGUAGES, TIMEZONES, VERTICALS, slugify, DEFAULT_HOURS } from "@/lib/aivora";
import { AivoraMark } from "@/components/brand/AivoraLogo";
import { SectionLabel } from "@/components/aivora/SectionLabel";
import { AuroraBackground } from "@/components/aivora/AuroraBackground";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your business — Aivora" },
      {
        name: "description",
        content: "Tell Aivora about your business so your receptionist sounds right.",
      },
      { property: "og:title", content: "Set up your business — Aivora" },
      {
        property: "og:description",
        content: "Add your business basics to start your AI receptionist.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { data: org, isLoading } = useOrg();
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState(VERTICALS[0]!);
  const [country, setCountry] = useState("US");
  const [timezone, setTimezone] = useState("America/New_York");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (org) navigate({ to: "/dashboard" });
  }, [org, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again.");

      const orgId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
              const r = (Math.random() * 16) | 0;
              const v = c === "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });

      const { error: orgError } = await supabase.from("organizations").insert({
        id: orgId,
        name,
        slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
        industry_vertical: vertical,
        country,
        timezone,
      });
      if (orgError) throw orgError;

      const { error: memberError } = await supabase
        .from("org_members")
        .insert({ org_id: orgId, user_id: auth.user.id, role: "owner" });
      if (memberError) throw memberError;

      const { error: profileError } = await supabase.from("business_profiles").insert({
        org_id: orgId,
        display_name: name,
        legal_name: name,
        languages,
        business_hours: DEFAULT_HOURS,
      });
      if (profileError) throw profileError;

      toast.success("Business saved. Let's build your receptionist.");
      navigate({ to: "/dashboard/voice/new" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your business.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-16">
      <AuroraBackground />
      <div className="relative mx-auto max-w-xl">
        <AivoraMark className="size-10 rounded-xl shadow-[0_4px_16px_-4px_var(--glow)]" />
        <div className="mt-6">
          <SectionLabel index={0}>Onboarding</SectionLabel>
        </div>
        <h1 className="mt-2 text-3xl font-bold">Tell us about your business</h1>
        <p className="mt-3 text-muted-foreground">
          Your receptionist uses these basics to greet callers correctly.
        </p>

        <form onSubmit={submit} className="glass glow mt-10 space-y-6 p-8">
          <div className="space-y-2">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Riverside plumbing"
            />
          </div>

          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={vertical} onValueChange={setVertical}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERTICALS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Languages callers may use</Label>
            <div className="flex flex-wrap gap-4">
              {LANGUAGES.map((lang) => (
                <label key={lang.code} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={languages.includes(lang.code)}
                    onCheckedChange={(checked) =>
                      setLanguages((current) =>
                        checked ? [...current, lang.code] : current.filter((c) => c !== lang.code),
                      )
                    }
                  />
                  {lang.label}
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={busy || !name}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
