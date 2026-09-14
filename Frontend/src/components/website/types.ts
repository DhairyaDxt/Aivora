// Shared types for the website builder. One SiteRenderer (see SiteRenderer.tsx)
// consumes these to render the exact same tree in three places: the live
// editor preview (inside an iframe), and the server-side static publish
// render - true WYSIWYG because it's literally the same components.

export type SectionType =
  "hero" | "about" | "services" | "gallery" | "testimonials" | "contactBooking" | "footer";

export type ThemeConfig = {
  primaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  radius: "none" | "sm" | "md" | "lg" | "full";
};

export type HeroContent = {
  eyebrow?: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink?: string;
  backgroundImage?: string;
};

export type AboutContent = {
  headline: string;
  body: string;
  image?: string;
};

export type ServiceItem = { title: string; description: string; price?: string };
export type ServicesContent = {
  headline: string;
  subheadline?: string;
  items: ServiceItem[];
};

export type GalleryContent = {
  headline?: string;
  images: string[];
};

export type TestimonialItem = { quote: string; author: string; role?: string };
export type TestimonialsContent = {
  headline?: string;
  items: TestimonialItem[];
};

export type ContactBookingContent = {
  headline: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
  bookingEnabled?: boolean;
  bookingUrl?: string;
};

export type FooterContent = {
  businessName: string;
  tagline?: string;
  links?: Array<{ label: string; href: string }>;
};

export type SectionContentMap = {
  hero: HeroContent;
  about: AboutContent;
  services: ServicesContent;
  gallery: GalleryContent;
  testimonials: TestimonialsContent;
  contactBooking: ContactBookingContent;
  footer: FooterContent;
};

export type SiteSection = {
  [K in SectionType]: {
    id: string;
    type: K;
    variant: string;
    visible: boolean;
    content: SectionContentMap[K];
  };
}[SectionType];

/** Site-wide header, shown on every page. Its links are derived from the
 * site's pages rather than edited by hand, so adding a page automatically
 * shows up in the nav. */
export type NavContent = {
  businessName: string;
  ctaText?: string;
  ctaLink?: string;
};

/** One page of a multi-page site. `slug` is "" for the home page, which
 * publishes to index.html; every other page publishes to <slug>/index.html
 * so the live URLs stay clean. */
export type SitePage = {
  id: string;
  slug: string;
  name: string;
  sections: SiteSection[];
  sortOrder: number;
  isHome: boolean;
  showInNav: boolean;
};

/** Everything the renderer needs to draw one page of a site. */
export type SiteData = {
  theme: ThemeConfig;
  nav: { variant: string; content: NavContent };
  footer: { variant: string; content: FooterContent };
  pages: Array<Pick<SitePage, "slug" | "name" | "showInNav">>;
  currentSlug: string;
  sections: SiteSection[];
};

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#2563eb",
  accentColor: "#f59e0b",
  fontHeading: "Poppins",
  fontBody: "Inter",
  radius: "lg",
};

export const FONT_OPTIONS = [
  "Inter",
  "Poppins",
  "Playfair Display",
  "DM Sans",
  "Fraunces",
  "Space Grotesk",
] as const;

export const RADIUS_PX: Record<ThemeConfig["radius"], string> = {
  none: "0px",
  sm: "6px",
  md: "12px",
  lg: "20px",
  full: "9999px",
};
