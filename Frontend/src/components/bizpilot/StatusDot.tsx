import { cn } from "@/lib/utils";

/** Small pulsing dot + label, e.g. "● LIVE" or "● AVAILABLE". */
export function StatusDot({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 label-tag", className)}>
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      {children}
    </span>
  );
}
