import { cn } from "@/lib/utils";
import { STATUS_LABEL, type ServiceStatus } from "@/lib/aivora";

const styles: Record<ServiceStatus, string> = {
  draft: "bg-status-draft/12 text-status-draft border-status-draft/25",
  testing: "bg-status-testing/12 text-status-testing border-status-testing/30",
  live: "bg-status-live/12 text-status-live border-status-live/30",
  needs_attention: "bg-status-attention/12 text-status-attention border-status-attention/30",
};

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const key = (status in STATUS_LABEL ? status : "draft") as ServiceStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[key],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[key]}
    </span>
  );
}
