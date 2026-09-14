import type { CSSProperties } from "react";
import type { ThemeConfig } from "./types";
import { RADIUS_PX } from "./types";

/** Turns a theme into a CSS custom-property string, applied once at the site
 * root. Section components reference these via Tailwind's arbitrary-value
 * syntax (e.g. `bg-[var(--bp-primary)]`) - the class names are fixed by our
 * code, only the values vary per business, which is what makes the compiled
 * Tailwind CSS shareable across every published site. */
export function themeCssVars(theme: ThemeConfig): CSSProperties {
  return {
    ["--bp-primary" as string]: theme.primaryColor,
    ["--bp-accent" as string]: theme.accentColor,
    ["--bp-font-heading" as string]: `"${theme.fontHeading}", sans-serif`,
    ["--bp-font-body" as string]: `"${theme.fontBody}", sans-serif`,
    ["--bp-radius" as string]: RADIUS_PX[theme.radius],
  } as CSSProperties;
}

/** Same as themeCssVars, but as a plain CSS declaration string - for
 * building the inline <style> block in the static published HTML document,
 * where there's no React style-object to hand to an element directly. */
export function themeCssVarsString(theme: ThemeConfig): string {
  return [
    `--bp-primary: ${theme.primaryColor}`,
    `--bp-accent: ${theme.accentColor}`,
    `--bp-font-heading: "${theme.fontHeading}", sans-serif`,
    `--bp-font-body: "${theme.fontBody}", sans-serif`,
    `--bp-radius: ${RADIUS_PX[theme.radius]}`,
  ].join("; ");
}

/** Google Fonts stylesheet URL for the theme's two fonts, deduped. */
export function googleFontsHref(theme: ThemeConfig): string {
  const families = Array.from(new Set([theme.fontHeading, theme.fontBody]));
  const params = families
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
