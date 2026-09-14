import { Plus, X } from "lucide-react";
import { EditableImage, EditableText } from "../Editable";
import { FadeIn } from "../FadeIn";
import type { GalleryContent } from "../types";
import type { SectionProps } from "./Hero";

function Header({ content, editable, onChange }: SectionProps<GalleryContent>) {
  if (!content.headline && !editable) return null;
  return (
    <EditableText
      as="h2"
      value={content.headline ?? ""}
      onChange={(v) => onChange({ ...content, headline: v })}
      editable={editable}
      placeholder="Gallery"
      className="mb-10 text-center text-3xl font-bold text-neutral-900 sm:text-4xl"
      style={{ fontFamily: "var(--bp-font-heading)" }}
    />
  );
}

function useImageHelpers(content: GalleryContent, onChange: (c: GalleryContent) => void) {
  const removeImage = (index: number) =>
    onChange({ ...content, images: content.images.filter((_, i) => i !== index) });
  const addImage = () => onChange({ ...content, images: [...content.images, ""] });
  const setImage = (index: number, url: string) =>
    onChange({ ...content, images: content.images.map((img, i) => (i === index ? url : img)) });
  return { removeImage, addImage, setImage };
}

export function GalleryGrid(props: SectionProps<GalleryContent>) {
  const { content, editable, onChange, onPickImage } = props;
  const { removeImage, addImage } = useImageHelpers(content, onChange);
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <FadeIn>
          <Header {...props} />
        </FadeIn>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {content.images.map((src, i) => (
            <FadeIn key={i} delay={i * 0.05}>
              <div className="group relative">
                <EditableImage
                  src={src}
                  alt=""
                  editable={editable}
                  onPick={() => onPickImage?.(`images.${i}`)}
                  className="aspect-square w-full overflow-hidden"
                  style={{ borderRadius: "var(--bp-radius)" }}
                />
                {editable ? (
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </FadeIn>
          ))}
          {editable ? (
            <button
              onClick={addImage}
              className="flex aspect-square items-center justify-center gap-2 border border-dashed border-neutral-300 text-sm text-neutral-500 hover:border-[var(--bp-primary)] hover:text-[var(--bp-primary)]"
              style={{ borderRadius: "var(--bp-radius)" }}
            >
              <Plus className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function GalleryFeatured(props: SectionProps<GalleryContent>) {
  const { content, editable, onChange, onPickImage } = props;
  const { removeImage, addImage } = useImageHelpers(content, onChange);
  const [first, ...rest] = content.images;
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <FadeIn>
          <Header {...props} />
        </FadeIn>
        <div className="grid gap-4 sm:grid-cols-2">
          <FadeIn className="sm:row-span-2">
            <EditableImage
              src={first}
              alt=""
              editable={editable}
              onPick={() => onPickImage?.("images.0")}
              className="aspect-square w-full overflow-hidden sm:aspect-auto sm:h-full"
              style={{ borderRadius: "var(--bp-radius)" }}
            />
          </FadeIn>
          <div className="grid grid-cols-2 gap-4">
            {rest.map((src, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <div className="group relative">
                  <EditableImage
                    src={src}
                    alt=""
                    editable={editable}
                    onPick={() => onPickImage?.(`images.${i + 1}`)}
                    className="aspect-square w-full overflow-hidden"
                    style={{ borderRadius: "var(--bp-radius)" }}
                  />
                  {editable ? (
                    <button
                      onClick={() => removeImage(i + 1)}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </FadeIn>
            ))}
            {editable ? (
              <button
                onClick={addImage}
                className="flex aspect-square items-center justify-center gap-2 border border-dashed border-neutral-300 text-sm text-neutral-500 hover:border-[var(--bp-primary)] hover:text-[var(--bp-primary)]"
                style={{ borderRadius: "var(--bp-radius)" }}
              >
                <Plus className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
