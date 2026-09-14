import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONT_OPTIONS, type ThemeConfig } from "./types";

const RADIUS_OPTIONS: Array<{ value: ThemeConfig["radius"]; label: string }> = [
  { value: "none", label: "Square" },
  { value: "sm", label: "Slightly rounded" },
  { value: "md", label: "Rounded" },
  { value: "lg", label: "Very rounded" },
  { value: "full", label: "Pill-shaped" },
];

export function ThemePanel({
  theme,
  onChange,
}: {
  theme: ThemeConfig;
  onChange: (theme: ThemeConfig) => void;
}) {
  const patch = (p: Partial<ThemeConfig>) => onChange({ ...theme, ...p });

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted-foreground">Theme</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="primary-color">Primary color</Label>
          <input
            id="primary-color"
            type="color"
            value={theme.primaryColor}
            onChange={(e) => patch({ primaryColor: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-md border"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accent-color">Accent color</Label>
          <input
            id="accent-color"
            type="color"
            value={theme.accentColor}
            onChange={(e) => patch({ accentColor: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-md border"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Heading font</Label>
        <Select value={theme.fontHeading} onValueChange={(v) => patch({ fontHeading: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Body font</Label>
        <Select value={theme.fontBody} onValueChange={(v) => patch({ fontBody: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Corner style</Label>
        <Select
          value={theme.radius}
          onValueChange={(v) => patch({ radius: v as ThemeConfig["radius"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
