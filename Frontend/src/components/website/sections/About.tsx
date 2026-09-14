import { EditableText, EditableImage } from "../Editable";
import { FadeIn } from "../FadeIn";
import type { AboutContent } from "../types";
import type { SectionProps } from "./Hero";

function Copy({ content, editable, onChange }: SectionProps<AboutContent>) {
  const patch = (p: Partial<AboutContent>) => onChange({ ...content, ...p });
  return (
    <div>
      <EditableText
        as="h2"
        value={content.headline}
        onChange={(v) => patch({ headline: v })}
        editable={editable}
        className="text-3xl font-bold text-neutral-900 sm:text-4xl"
        style={{ fontFamily: "var(--bp-font-heading)" }}
      />
      <EditableText
        as="p"
        value={content.body}
        onChange={(v) => patch({ body: v })}
        editable={editable}
        className="mt-5 text-base leading-relaxed whitespace-pre-line text-neutral-600"
      />
    </div>
  );
}

export function AboutImageLeft(props: SectionProps<AboutContent>) {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
        <FadeIn>
          <EditableImage
            src={props.content.image}
            alt=""
            editable={props.editable}
            onPick={() => props.onPickImage?.("image")}
            className="aspect-4/3 w-full overflow-hidden"
            fallbackClassName="min-h-[280px]"
            style={{ borderRadius: "var(--bp-radius)" }}
          />
        </FadeIn>
        <FadeIn delay={0.1}>
          <Copy {...props} />
        </FadeIn>
      </div>
    </section>
  );
}

export function AboutStacked(props: SectionProps<AboutContent>) {
  return (
    <section className="bg-[color-mix(in_srgb,var(--bp-primary)_5%,white)]">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <FadeIn>
          <Copy {...props} />
        </FadeIn>
        <FadeIn delay={0.1}>
          <EditableImage
            src={props.content.image}
            alt=""
            editable={props.editable}
            onPick={() => props.onPickImage?.("image")}
            className="mx-auto mt-10 aspect-16/9 w-full max-w-2xl overflow-hidden"
            fallbackClassName="min-h-[240px]"
            style={{ borderRadius: "var(--bp-radius)" }}
          />
        </FadeIn>
      </div>
    </section>
  );
}
