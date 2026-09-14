import type { ComponentType } from "react";
import { HeroCentered, HeroSplit, type SectionProps } from "./sections/Hero";
import { AboutImageLeft, AboutStacked } from "./sections/About";
import { ServicesCards, ServicesList } from "./sections/Services";
import { GalleryGrid, GalleryFeatured } from "./sections/Gallery";
import { TestimonialsGrid, TestimonialsSpotlight } from "./sections/Testimonials";
import { ContactBookingSplit, ContactBookingCentered } from "./sections/ContactBooking";
import { FooterSimple, FooterColumns } from "./sections/Footer";
import { Navbar } from "./sections/Navbar";
import { themeCssVars } from "./theme";
import type { FooterContent, NavContent, SiteSection, SitePage, ThemeConfig } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySectionComponent = ComponentType<SectionProps<any>>;

const SECTION_COMPONENTS: Record<string, Record<string, AnySectionComponent>> = {
  hero: { centered: HeroCentered, split: HeroSplit },
  about: { imageLeft: AboutImageLeft, stacked: AboutStacked },
  services: { cards: ServicesCards, list: ServicesList },
  gallery: { grid: GalleryGrid, featured: GalleryFeatured },
  testimonials: { grid: TestimonialsGrid, spotlight: TestimonialsSpotlight },
  contactBooking: { split: ContactBookingSplit, centered: ContactBookingCentered },
  footer: { simple: FooterSimple, columns: FooterColumns },
};

/**
 * Renders one page of a site: the shared nav, that page's sections, then the
 * shared footer. Used by the editor's iframe preview and by the static
 * publish render alike, so what you edit is exactly what ships.
 */
export function SiteRenderer({
  sections,
  theme,
  nav,
  footer,
  pages,
  currentSlug,
  editable,
  onSectionChange,
  onPickImage,
  onNavChange,
  onFooterChange,
  onNavigate,
}: {
  sections: SiteSection[];
  theme: ThemeConfig;
  nav: { variant: string; content: NavContent };
  footer: { variant: string; content: FooterContent };
  pages: Array<Pick<SitePage, "slug" | "name" | "showInNav">>;
  currentSlug: string;
  editable: boolean;
  onSectionChange?: (sectionId: string, content: unknown) => void;
  onPickImage?: (sectionId: string, field: string) => void;
  onNavChange?: (content: NavContent) => void;
  onFooterChange?: (content: FooterContent) => void;
  onNavigate?: (slug: string) => void;
}) {
  const FooterComponent = SECTION_COMPONENTS["footer"]?.[footer.variant] ?? FooterColumns;

  return (
    <div
      style={{ ...themeCssVars(theme), fontFamily: "var(--bp-font-body)" }}
      className="min-h-screen bg-white"
    >
      <Navbar
        content={nav.content}
        variant={nav.variant}
        editable={editable}
        onChange={(content) => onNavChange?.(content)}
        pages={pages}
        currentSlug={currentSlug}
        {...(onNavigate ? { onNavigate } : {})}
      />

      {sections
        .filter((s) => s.visible)
        .map((section) => {
          const Component = SECTION_COMPONENTS[section.type]?.[section.variant];
          if (!Component) return null;
          return (
            <Component
              key={section.id}
              content={section.content}
              editable={editable}
              onChange={(next: unknown) => onSectionChange?.(section.id, next)}
              onPickImage={(field: string) => onPickImage?.(section.id, field)}
            />
          );
        })}

      <FooterComponent
        content={footer.content}
        editable={editable}
        onChange={(next: unknown) => onFooterChange?.(next as FooterContent)}
      />
    </div>
  );
}
