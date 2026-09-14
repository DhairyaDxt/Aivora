import { motion } from "framer-motion";
import { EditableText, EditableImage } from "../Editable";
import { FadeIn } from "../FadeIn";
import type { HeroContent } from "../types";

export type SectionProps<T> = {
  content: T;
  editable: boolean;
  onChange: (content: T) => void;
  onPickImage?: (field: string) => void;
};

export function HeroCentered({
  content,
  editable,
  onChange,
  onPickImage,
}: SectionProps<HeroContent>) {
  const patch = (p: Partial<HeroContent>) => onChange({ ...content, ...p });
  return (
    <section className="relative overflow-hidden bg-[var(--bp-font-body)]">
      <EditableImage
        src={content.backgroundImage}
        alt=""
        editable={editable}
        onPick={() => onPickImage?.("backgroundImage")}
        className="absolute inset-0"
        fallbackClassName="bg-gradient-to-br from-[var(--bp-primary)]/20 to-[var(--bp-accent)]/20"
      />
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative mx-auto flex min-h-[560px] max-w-4xl flex-col items-center justify-center px-6 py-28 text-center text-white">
        {content.eyebrow ? (
          <FadeIn>
            <EditableText
              as="p"
              value={content.eyebrow}
              onChange={(v) => patch({ eyebrow: v })}
              editable={editable}
              className="mb-4 inline-block rounded-full border border-white/30 px-4 py-1 text-xs font-semibold tracking-wide uppercase"
            />
          </FadeIn>
        ) : null}
        <FadeIn delay={0.1}>
          <EditableText
            as="h1"
            value={content.headline}
            onChange={(v) => patch({ headline: v })}
            editable={editable}
            className="text-4xl leading-tight font-bold sm:text-6xl"
            style={{ fontFamily: "var(--bp-font-heading)" }}
          />
        </FadeIn>
        <FadeIn delay={0.2}>
          <EditableText
            as="p"
            value={content.subheadline}
            onChange={(v) => patch({ subheadline: v })}
            editable={editable}
            className="mt-5 max-w-xl text-lg text-white/85"
          />
        </FadeIn>
        <FadeIn delay={0.3}>
          <motion.a
            href={content.ctaLink ?? "#contact"}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="mt-8 inline-block bg-[var(--bp-primary)] px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.97]"
            style={{ borderRadius: "var(--bp-radius)" }}
          >
            <EditableText
              value={content.ctaText}
              onChange={(v) => patch({ ctaText: v })}
              editable={editable}
            />
          </motion.a>
        </FadeIn>
      </div>
    </section>
  );
}

export function HeroSplit({ content, editable, onChange, onPickImage }: SectionProps<HeroContent>) {
  const patch = (p: Partial<HeroContent>) => onChange({ ...content, ...p });
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
        <FadeIn>
          <div>
            {content.eyebrow ? (
              <EditableText
                as="p"
                value={content.eyebrow}
                onChange={(v) => patch({ eyebrow: v })}
                editable={editable}
                className="mb-4 text-sm font-semibold tracking-wide text-[var(--bp-primary)] uppercase"
              />
            ) : null}
            <EditableText
              as="h1"
              value={content.headline}
              onChange={(v) => patch({ headline: v })}
              editable={editable}
              className="text-4xl leading-tight font-bold text-neutral-900 sm:text-5xl"
              style={{ fontFamily: "var(--bp-font-heading)" }}
            />
            <EditableText
              as="p"
              value={content.subheadline}
              onChange={(v) => patch({ subheadline: v })}
              editable={editable}
              className="mt-5 text-lg text-neutral-600"
            />
            <motion.a
              href={content.ctaLink ?? "#contact"}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="mt-8 inline-block bg-[var(--bp-primary)] px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.97]"
              style={{ borderRadius: "var(--bp-radius)" }}
            >
              <EditableText
                value={content.ctaText}
                onChange={(v) => patch({ ctaText: v })}
                editable={editable}
              />
            </motion.a>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <EditableImage
            src={content.backgroundImage}
            alt=""
            editable={editable}
            onPick={() => onPickImage?.("backgroundImage")}
            className="aspect-4/3 w-full overflow-hidden"
            fallbackClassName="min-h-[320px]"
            style={{ borderRadius: "var(--bp-radius)" }}
          />
        </FadeIn>
      </div>
    </section>
  );
}
