import { motion } from "framer-motion";
import { Calendar, Clock, Mail, MapPin, Phone } from "lucide-react";
import { EditableText } from "../Editable";
import { FadeIn } from "../FadeIn";
import type { ContactBookingContent } from "../types";
import type { SectionProps } from "./Hero";

function DetailRow({
  icon: Icon,
  value,
  onChange,
  editable,
  placeholder,
}: {
  icon: typeof Phone;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  placeholder: string;
}) {
  if (!value && !editable) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-neutral-600">
      <Icon className="size-4 shrink-0 text-[var(--bp-primary)]" />
      <EditableText
        value={value}
        onChange={onChange}
        editable={editable}
        placeholder={placeholder}
      />
    </div>
  );
}

function BookButton({ content }: { content: ContactBookingContent }) {
  const href =
    content.bookingEnabled && content.bookingUrl
      ? content.bookingUrl
      : `tel:${content.phone ?? ""}`;
  return (
    <motion.a
      href={href}
      target={content.bookingEnabled ? "_blank" : undefined}
      rel="noreferrer"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-2 bg-[var(--bp-primary)] px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.97]"
      style={{ borderRadius: "var(--bp-radius)" }}
    >
      <Calendar className="size-4" />
      {content.bookingEnabled ? "Book now" : "Get in touch"}
    </motion.a>
  );
}

function Details(props: SectionProps<ContactBookingContent> & { layout?: "stack" | "inline" }) {
  const { content, editable, onChange, layout = "stack" } = props;
  const patch = (p: Partial<ContactBookingContent>) => onChange({ ...content, ...p });
  return (
    <div
      className={
        layout === "stack"
          ? "space-y-3"
          : "flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
      }
    >
      <DetailRow
        icon={MapPin}
        value={content.address ?? ""}
        onChange={(v) => patch({ address: v })}
        editable={editable}
        placeholder="Add your address"
      />
      <DetailRow
        icon={Phone}
        value={content.phone ?? ""}
        onChange={(v) => patch({ phone: v })}
        editable={editable}
        placeholder="Add a phone number"
      />
      <DetailRow
        icon={Mail}
        value={content.email ?? ""}
        onChange={(v) => patch({ email: v })}
        editable={editable}
        placeholder="Add an email"
      />
      <DetailRow
        icon={Clock}
        value={content.hours ?? ""}
        onChange={(v) => patch({ hours: v })}
        editable={editable}
        placeholder="Add your hours"
      />
    </div>
  );
}

export function ContactBookingSplit(props: SectionProps<ContactBookingContent>) {
  const { content, editable, onChange } = props;
  const patch = (p: Partial<ContactBookingContent>) => onChange({ ...content, ...p });
  return (
    <section id="contact" className="bg-white">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-24 lg:grid-cols-2">
        <FadeIn>
          <EditableText
            as="h2"
            value={content.headline}
            onChange={(v) => patch({ headline: v })}
            editable={editable}
            className="text-3xl font-bold text-neutral-900 sm:text-4xl"
            style={{ fontFamily: "var(--bp-font-heading)" }}
          />
          {content.description || editable ? (
            <EditableText
              as="p"
              value={content.description ?? ""}
              onChange={(v) => patch({ description: v })}
              editable={editable}
              placeholder="Add a short note about getting in touch…"
              className="mt-4 text-neutral-600"
            />
          ) : null}
          <div className="mt-8">
            <BookButton content={content} />
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div
            className="h-full border border-neutral-200 p-8"
            style={{ borderRadius: "var(--bp-radius)" }}
          >
            <Details {...props} />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

export function ContactBookingCentered(props: SectionProps<ContactBookingContent>) {
  const { content, editable, onChange } = props;
  const patch = (p: Partial<ContactBookingContent>) => onChange({ ...content, ...p });
  return (
    <section id="contact" className="bg-[color-mix(in_srgb,var(--bp-primary)_6%,white)]">
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <FadeIn>
          <EditableText
            as="h2"
            value={content.headline}
            onChange={(v) => patch({ headline: v })}
            editable={editable}
            className="text-3xl font-bold text-neutral-900 sm:text-4xl"
            style={{ fontFamily: "var(--bp-font-heading)" }}
          />
          {content.description || editable ? (
            <EditableText
              as="p"
              value={content.description ?? ""}
              onChange={(v) => patch({ description: v })}
              editable={editable}
              placeholder="Add a short note about getting in touch…"
              className="mt-4 text-neutral-600"
            />
          ) : null}
          <div className="mt-8 flex justify-center">
            <BookButton content={content} />
          </div>
          <div className="mt-10">
            <Details {...props} layout="inline" />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
