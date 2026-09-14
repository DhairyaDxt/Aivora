import { Plus, Quote, Trash2 } from "lucide-react";
import { EditableText } from "../Editable";
import { FadeIn } from "../FadeIn";
import type { TestimonialItem, TestimonialsContent } from "../types";
import type { SectionProps } from "./Hero";

function Header({ content, editable, onChange }: SectionProps<TestimonialsContent>) {
  if (!content.headline && !editable) return null;
  return (
    <EditableText
      as="h2"
      value={content.headline ?? ""}
      onChange={(v) => onChange({ ...content, headline: v })}
      editable={editable}
      placeholder="What people say"
      className="mb-12 text-center text-3xl font-bold text-neutral-900 sm:text-4xl"
      style={{ fontFamily: "var(--bp-font-heading)" }}
    />
  );
}

function useItemHelpers(content: TestimonialsContent, onChange: (c: TestimonialsContent) => void) {
  const updateItem = (index: number, patch: Partial<TestimonialItem>) =>
    onChange({
      ...content,
      items: content.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    });
  const addItem = () =>
    onChange({
      ...content,
      items: [...content.items, { quote: "A wonderful experience.", author: "Happy customer" }],
    });
  const removeItem = (index: number) =>
    onChange({ ...content, items: content.items.filter((_, i) => i !== index) });
  return { updateItem, addItem, removeItem };
}

function Card({
  item,
  editable,
  onChange,
  onRemove,
  size = "md",
}: {
  item: TestimonialItem;
  editable: boolean;
  onChange: (patch: Partial<TestimonialItem>) => void;
  onRemove: () => void;
  size?: "md" | "lg";
}) {
  return (
    <div
      className="group relative h-full border border-neutral-200 bg-white p-6"
      style={{ borderRadius: "var(--bp-radius)" }}
    >
      {editable ? (
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 rounded-full p-1 text-neutral-400 opacity-0 hover:bg-neutral-100 group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
      <Quote className="size-6 text-[var(--bp-accent)]" />
      <EditableText
        as="p"
        value={item.quote}
        onChange={(v) => onChange({ quote: v })}
        editable={editable}
        className={
          size === "lg" ? "mt-4 text-xl leading-relaxed text-neutral-800" : "mt-4 text-neutral-700"
        }
      />
      <div className="mt-5 flex items-center gap-2">
        <EditableText
          value={item.author}
          onChange={(v) => onChange({ author: v })}
          editable={editable}
          className="text-sm font-semibold text-neutral-900"
        />
        {item.role || editable ? (
          <>
            <span className="text-neutral-300">·</span>
            <EditableText
              value={item.role ?? ""}
              onChange={(v) => onChange({ role: v })}
              editable={editable}
              placeholder="Role"
              className="text-sm text-neutral-500"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function TestimonialsGrid(props: SectionProps<TestimonialsContent>) {
  const { content, editable, onChange } = props;
  const { updateItem, addItem, removeItem } = useItemHelpers(content, onChange);
  return (
    <section className="bg-[color-mix(in_srgb,var(--bp-primary)_4%,white)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <FadeIn>
          <Header {...props} />
        </FadeIn>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {content.items.map((item, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <Card
                item={item}
                editable={editable}
                onChange={(p) => updateItem(i, p)}
                onRemove={() => removeItem(i)}
              />
            </FadeIn>
          ))}
          {editable ? (
            <button
              onClick={addItem}
              className="flex min-h-[160px] items-center justify-center gap-2 border border-dashed border-neutral-300 text-sm text-neutral-500 hover:border-[var(--bp-primary)] hover:text-[var(--bp-primary)]"
              style={{ borderRadius: "var(--bp-radius)" }}
            >
              <Plus className="size-4" /> Add testimonial
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSpotlight(props: SectionProps<TestimonialsContent>) {
  const { content, editable, onChange } = props;
  const { updateItem, addItem, removeItem } = useItemHelpers(content, onChange);
  const [first, ...rest] = content.items;
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <FadeIn>
          <Header {...props} />
        </FadeIn>
        {first ? (
          <FadeIn className="mx-auto max-w-2xl">
            <Card
              item={first}
              editable={editable}
              onChange={(p) => updateItem(0, p)}
              onRemove={() => removeItem(0)}
              size="lg"
            />
          </FadeIn>
        ) : null}
        {rest.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {rest.map((item, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <Card
                  item={item}
                  editable={editable}
                  onChange={(p) => updateItem(i + 1, p)}
                  onRemove={() => removeItem(i + 1)}
                />
              </FadeIn>
            ))}
          </div>
        ) : null}
        {editable ? (
          <button
            onClick={addItem}
            className="mx-auto mt-6 flex items-center gap-2 text-sm text-neutral-500 hover:text-[var(--bp-primary)]"
          >
            <Plus className="size-4" /> Add testimonial
          </button>
        ) : null}
      </div>
    </section>
  );
}
