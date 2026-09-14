import { Plus, Trash2 } from "lucide-react";
import { EditableText } from "../Editable";
import { FadeIn } from "../FadeIn";
import type { ServiceItem, ServicesContent } from "../types";
import type { SectionProps } from "./Hero";

function Header({ content, editable, onChange }: SectionProps<ServicesContent>) {
  const patch = (p: Partial<ServicesContent>) => onChange({ ...content, ...p });
  return (
    <div className="mx-auto max-w-2xl text-center">
      <EditableText
        as="h2"
        value={content.headline}
        onChange={(v) => patch({ headline: v })}
        editable={editable}
        className="text-3xl font-bold text-neutral-900 sm:text-4xl"
        style={{ fontFamily: "var(--bp-font-heading)" }}
      />
      {content.subheadline || editable ? (
        <EditableText
          as="p"
          value={content.subheadline ?? ""}
          onChange={(v) => patch({ subheadline: v })}
          editable={editable}
          placeholder="Add a short intro…"
          className="mt-3 text-neutral-600"
        />
      ) : null}
    </div>
  );
}

function useItemHelpers(content: ServicesContent, onChange: (c: ServicesContent) => void) {
  const updateItem = (index: number, patch: Partial<ServiceItem>) => {
    const items = content.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange({ ...content, items });
  };
  const addItem = () =>
    onChange({
      ...content,
      items: [...content.items, { title: "New service", description: "Describe it here." }],
    });
  const removeItem = (index: number) =>
    onChange({ ...content, items: content.items.filter((_, i) => i !== index) });
  return { updateItem, addItem, removeItem };
}

export function ServicesCards(props: SectionProps<ServicesContent>) {
  const { content, editable, onChange } = props;
  const { updateItem, addItem, removeItem } = useItemHelpers(content, onChange);
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <FadeIn>
          <Header {...props} />
        </FadeIn>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {content.items.map((item, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div
                className="group relative h-full border border-neutral-200 p-6 transition-shadow hover:shadow-lg"
                style={{ borderRadius: "var(--bp-radius)" }}
              >
                {editable ? (
                  <button
                    onClick={() => removeItem(i)}
                    className="absolute top-3 right-3 rounded-full p-1 text-neutral-400 opacity-0 hover:bg-neutral-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
                <EditableText
                  as="h3"
                  value={item.title}
                  onChange={(v) => updateItem(i, { title: v })}
                  editable={editable}
                  className="text-lg font-semibold text-neutral-900"
                  style={{ fontFamily: "var(--bp-font-heading)" }}
                />
                <EditableText
                  as="p"
                  value={item.description}
                  onChange={(v) => updateItem(i, { description: v })}
                  editable={editable}
                  className="mt-2 text-sm text-neutral-600"
                />
                {item.price || editable ? (
                  <EditableText
                    as="p"
                    value={item.price ?? ""}
                    onChange={(v) => updateItem(i, { price: v })}
                    editable={editable}
                    placeholder="$—"
                    className="mt-4 text-sm font-semibold text-[var(--bp-primary)]"
                  />
                ) : null}
              </div>
            </FadeIn>
          ))}
          {editable ? (
            <button
              onClick={addItem}
              className="flex min-h-[140px] items-center justify-center gap-2 border border-dashed border-neutral-300 text-sm text-neutral-500 hover:border-[var(--bp-primary)] hover:text-[var(--bp-primary)]"
              style={{ borderRadius: "var(--bp-radius)" }}
            >
              <Plus className="size-4" /> Add service
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ServicesList(props: SectionProps<ServicesContent>) {
  const { content, editable, onChange } = props;
  const { updateItem, addItem, removeItem } = useItemHelpers(content, onChange);
  return (
    <section className="bg-[color-mix(in_srgb,var(--bp-primary)_4%,white)]">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <FadeIn>
          <Header {...props} />
        </FadeIn>
        <div className="mt-12 divide-y divide-neutral-200">
          {content.items.map((item, i) => (
            <FadeIn key={i} delay={i * 0.06}>
              <div className="group relative flex items-baseline justify-between gap-6 py-5">
                <div>
                  <EditableText
                    as="h3"
                    value={item.title}
                    onChange={(v) => updateItem(i, { title: v })}
                    editable={editable}
                    className="text-lg font-semibold text-neutral-900"
                    style={{ fontFamily: "var(--bp-font-heading)" }}
                  />
                  <EditableText
                    as="p"
                    value={item.description}
                    onChange={(v) => updateItem(i, { description: v })}
                    editable={editable}
                    className="mt-1 text-sm text-neutral-600"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <EditableText
                    value={item.price ?? ""}
                    onChange={(v) => updateItem(i, { price: v })}
                    editable={editable}
                    placeholder="$—"
                    className="font-semibold whitespace-nowrap text-[var(--bp-primary)]"
                  />
                  {editable ? (
                    <button
                      onClick={() => removeItem(i)}
                      className="rounded-full p-1 text-neutral-400 opacity-0 hover:bg-neutral-100 group-hover:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
        {editable ? (
          <button
            onClick={addItem}
            className="mt-4 flex items-center gap-2 text-sm text-neutral-500 hover:text-[var(--bp-primary)]"
          >
            <Plus className="size-4" /> Add service
          </button>
        ) : null}
      </div>
    </section>
  );
}
