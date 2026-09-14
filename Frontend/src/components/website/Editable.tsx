import { useRef } from "react";
import { cn } from "@/lib/utils";
import { ImagePlus } from "lucide-react";

/**
 * Wraps a piece of text so it's plain, static markup when `editable` is
 * false (the published site, or a read-only preview), and a click-to-edit
 * contentEditable field when true (inside the builder's iframe). Same
 * component either way - that's what keeps the preview truly WYSIWYG.
 */
export function EditableText({
  value,
  onChange,
  editable,
  as: Tag = "span",
  className,
  placeholder,
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  editable: boolean;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
  className?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);

  if (!editable) {
    return (
      <Tag className={className} style={style}>
        {value || placeholder}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref as never}
      className={cn(
        className,
        "cursor-text rounded outline-none transition-shadow hover:shadow-[0_0_0_1px_var(--bp-primary)] focus:shadow-[0_0_0_2px_var(--bp-primary)]",
      )}
      style={style}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
      data-placeholder={placeholder}
    >
      {value}
    </Tag>
  );
}

/**
 * An image with a hover "change image" affordance in edit mode. `onPick`
 * opens the asset picker in the parent (the iframe posts a message up).
 */
export function EditableImage({
  src,
  alt,
  editable,
  onPick,
  className,
  fallbackClassName,
  style,
}: {
  src: string | undefined;
  alt: string;
  editable: boolean;
  onPick: () => void;
  className?: string;
  fallbackClassName?: string;
  style?: React.CSSProperties;
}) {
  if (!editable) {
    return src ? (
      <img src={src} alt={alt} className={className} style={style} />
    ) : (
      <div className={cn(className, fallbackClassName, "bg-black/5")} style={style} />
    );
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(className, "group relative block w-full overflow-hidden text-left")}
      style={style}
    >
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <div
          className={cn("flex size-full items-center justify-center bg-black/5", fallbackClassName)}
        >
          <ImagePlus className="size-6 text-black/30" />
        </div>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
        <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black">
          <ImagePlus className="size-3.5" /> Change image
        </span>
      </span>
    </button>
  );
}
