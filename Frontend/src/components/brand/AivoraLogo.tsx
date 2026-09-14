import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Aivora's mark: an "A" under an aurora arc, its crossbar bowed into a speech
 * curve. The name reads as AI + aurora, so the mark carries both — the arc is
 * the aurora, the curved bar is the voice underneath it.
 *
 * Built from strokes rather than filled paths so it stays legible when it's
 * shrunk to a 16px favicon, where fine counters would just fill in. The same
 * geometry is duplicated in public/favicon.svg (which can't use CSS vars) and
 * in the raster icons — change all three together.
 */
export function AivoraMark({
  className,
  tile = true,
  gradientId,
}: {
  className?: string;
  /** With the gradient tile behind it (app/nav use), or the bare glyph. */
  tile?: boolean;
  gradientId?: string;
}) {
  // The mark appears more than once per page (nav, footer, sidebar), so the
  // gradient needs an id of its own each time or the ids collide. useId's
  // colons are stripped because they're awkward inside url(#...).
  const autoId = `aivora-mark-${useId().replace(/:/g, "")}`;
  const gid = gradientId ?? autoId;
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--grad-from, #6366f1)" />
          <stop offset="1" stopColor="var(--grad-to, #22d3ee)" />
        </linearGradient>
      </defs>

      {tile ? <rect width="32" height="32" rx="9" fill={`url(#${gid})`} /> : null}

      {/* Aurora arc, held clear of the apex so both read at favicon sizes */}
      <path
        d="M9.6 9.8C11.8 6.3 20.2 6.3 22.4 9.8"
        stroke={tile ? "rgba(255,255,255,0.55)" : `url(#${gid})`}
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity={tile ? 1 : 0.55}
      />

      {/* The A */}
      <path
        d="M8.6 24.4L16 11.4L23.4 24.4"
        stroke={tile ? "#fff" : `url(#${gid})`}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Crossbar bowed like a speech curve rather than ruled straight */}
      <path
        d="M10.8 19.9C13.1 22.4 18.9 22.4 21.2 19.9"
        stroke={tile ? "#fff" : `url(#${gid})`}
        strokeWidth="2.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AivoraWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display leading-none font-bold tracking-tight", className)}>
      aivora
    </span>
  );
}

/** Mark + wordmark, linking home by default. */
export function AivoraLogo({
  className,
  size = "md",
  to = "/",
  showWordmark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  to?: string | undefined;
  showWordmark?: boolean;
}) {
  const sizes = {
    sm: { mark: "size-7", text: "text-base" },
    md: { mark: "size-8", text: "text-lg" },
    lg: { mark: "size-11", text: "text-2xl" },
  }[size];

  const content = (
    <>
      <span
        className={cn(
          "relative shrink-0 rounded-xl shadow-[0_4px_16px_-4px_var(--glow)]",
          sizes.mark,
        )}
      >
        <AivoraMark className="size-full" />
      </span>
      {showWordmark ? <AivoraWordmark className={sizes.text} /> : null}
    </>
  );

  if (!to) {
    return <span className={cn("flex items-center gap-2.5", className)}>{content}</span>;
  }

  return (
    <Link to={to} className={cn("flex items-center gap-2.5", className)}>
      {content}
    </Link>
  );
}
