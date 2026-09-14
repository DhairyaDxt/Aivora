export const VERTICALS = [
  "Home services",
  "Beauty and wellness",
  "Health and dental",
  "Legal",
  "Real estate",
  "Automotive",
  "Restaurant and hospitality",
  "Fitness",
  "Professional services",
  "Other",
];

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" },
];

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Dublin",
  "Australia/Sydney",
];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
];

export const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — warm, neutral" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi — bright, upbeat" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — calm, friendly" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni — steady, male" },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli — youthful, female" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh — deep, male" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold — confident, male" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam — natural, male" },
];

export const VOICE_MODELS = [
  { id: "eleven_turbo_v2_5", label: "Turbo — fastest replies" },
  { id: "eleven_multilingual_v2", label: "Multilingual — more languages" },
];

export const LLM_MODELS = [
  { id: "gpt-4o-mini", label: "Fast and affordable" },
  { id: "gpt-4o", label: "Most capable" },
];

export const TRANSCRIBER_MODELS = [
  { id: "nova-2", label: "Nova 2 — best accuracy" },
  { id: "nova-3", label: "Nova 3 — newest" },
];

export const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export type BusinessHours = Record<string, Array<{ open: string; close: string }>>;

export const DEFAULT_HOURS: BusinessHours = {
  mon: [{ open: "09:00", close: "17:00" }],
  tue: [{ open: "09:00", close: "17:00" }],
  wed: [{ open: "09:00", close: "17:00" }],
  thu: [{ open: "09:00", close: "17:00" }],
  fri: [{ open: "09:00", close: "17:00" }],
  sat: [],
  sun: [],
};

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "business"
  );
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export type ServiceStatus = "draft" | "testing" | "live" | "needs_attention";

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  draft: "Draft",
  testing: "Testing",
  live: "Live",
  needs_attention: "Needs attention",
};
