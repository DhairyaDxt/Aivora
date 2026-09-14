import type {
  FooterContent,
  NavContent,
  ServiceItem,
  SiteSection,
  TestimonialItem,
  ThemeConfig,
} from "./types";

export type TemplatePage = { slug: string; name: string; sections: SiteSection[] };

export type TemplateDef = {
  id: string;
  name: string;
  description: string;
  /** Matched against organizations.industry_vertical to surface relevant
   * templates first; `tags` additionally feeds the picker's search box. */
  bestFor: string[];
  tags: string[];
  previewImage: string;
  theme: ThemeConfig;
  nav: { variant: string; content: NavContent };
  footer: { variant: string; content: FooterContent };
  pages: TemplatePage[];
};

// Lorem Picsum is a stable, always-on placeholder photo service (unlike
// Unsplash's old "Source" endpoint, which was discontinued) - a fixed seed
// keeps the same photo across reloads instead of a new random one each time.
// These are just defaults; businesses replace them via upload/click-to-edit.
function placeholder(seed: string, w = 1600, h = 900) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

type TemplateSpec = {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
  tags: string[];
  theme: ThemeConfig;
  variants: {
    nav: "simple" | "centered";
    hero: "centered" | "split";
    about: "imageLeft" | "stacked";
    services: "cards" | "list";
    gallery: "grid" | "featured";
    testimonials: "grid" | "spotlight";
    contact: "split" | "centered";
    footer: "simple" | "columns";
  };
  servicesPageName: string;
  includeGallery: boolean;
  copy: {
    heroEyebrow?: string;
    heroHeadline: string;
    heroSub: string;
    heroCta: string;
    aboutHeadline: string;
    aboutBody: string;
    servicesHeadline: string;
    servicesSub?: string;
    services: ServiceItem[];
    galleryHeadline?: string;
    testimonialsHeadline: string;
    testimonials: TestimonialItem[];
    contactHeadline: string;
    contactDescription: string;
    footerTagline: string;
  };
};

/** Builds a full multi-page site from a compact spec. Every template shares
 * the same page skeleton (Home / About / Services / [Gallery] / Contact) so
 * the editor, the nav and the publish pipeline behave identically no matter
 * which template a business picks - the variety comes from the theme,
 * variant choices and copy. */
function buildTemplate(spec: TemplateSpec): TemplateDef {
  const { copy, variants, id } = spec;

  const hero = (idSuffix: string, headline: string, sub: string): SiteSection => ({
    id: `hero-${idSuffix}`,
    type: "hero",
    variant: variants.hero,
    visible: true,
    content: {
      ...(copy.heroEyebrow ? { eyebrow: copy.heroEyebrow } : {}),
      headline,
      subheadline: sub,
      ctaText: copy.heroCta,
      backgroundImage: placeholder(`${id}-hero-${idSuffix}`),
    },
  });

  const about = (idSuffix: string): SiteSection => ({
    id: `about-${idSuffix}`,
    type: "about",
    variant: variants.about,
    visible: true,
    content: {
      headline: copy.aboutHeadline,
      body: copy.aboutBody,
      image: placeholder(`${id}-about`),
    },
  });

  const services = (idSuffix: string): SiteSection => ({
    id: `services-${idSuffix}`,
    type: "services",
    variant: variants.services,
    visible: true,
    content: {
      headline: copy.servicesHeadline,
      ...(copy.servicesSub ? { subheadline: copy.servicesSub } : {}),
      items: copy.services,
    },
  });

  const gallery = (idSuffix: string): SiteSection => ({
    id: `gallery-${idSuffix}`,
    type: "gallery",
    variant: variants.gallery,
    visible: true,
    content: {
      ...(copy.galleryHeadline ? { headline: copy.galleryHeadline } : {}),
      images: [
        placeholder(`${id}-g1`, 800, 800),
        placeholder(`${id}-g2`, 800, 800),
        placeholder(`${id}-g3`, 800, 800),
        placeholder(`${id}-g4`, 800, 800),
      ],
    },
  });

  const testimonials = (idSuffix: string): SiteSection => ({
    id: `testimonials-${idSuffix}`,
    type: "testimonials",
    variant: variants.testimonials,
    visible: true,
    content: { headline: copy.testimonialsHeadline, items: copy.testimonials },
  });

  const contact = (idSuffix: string): SiteSection => ({
    id: `contact-${idSuffix}`,
    type: "contactBooking",
    variant: variants.contact,
    visible: true,
    content: {
      headline: copy.contactHeadline,
      description: copy.contactDescription,
      bookingEnabled: false,
    },
  });

  const pages: TemplatePage[] = [
    {
      slug: "",
      name: "Home",
      sections: [
        hero("home", copy.heroHeadline, copy.heroSub),
        about("home"),
        services("home"),
        testimonials("home"),
        contact("home"),
      ],
    },
    {
      slug: "about",
      name: "About",
      sections: [
        hero("about", copy.aboutHeadline, copy.heroSub),
        about("page"),
        testimonials("about"),
      ],
    },
    {
      slug: "services",
      name: spec.servicesPageName,
      sections: [
        hero("services", copy.servicesHeadline, copy.servicesSub ?? copy.heroSub),
        services("page"),
        contact("services"),
      ],
    },
    ...(spec.includeGallery
      ? [
          {
            slug: "gallery",
            name: "Gallery",
            sections: [gallery("page")],
          },
        ]
      : []),
    {
      slug: "contact",
      name: "Contact",
      sections: [contact("page")],
    },
  ];

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    bestFor: spec.bestFor,
    tags: spec.tags,
    previewImage: placeholder(`${spec.id}-preview`, 800, 600),
    theme: spec.theme,
    nav: {
      variant: variants.nav,
      content: { businessName: "Your Business", ctaText: copy.heroCta, ctaLink: "/contact/" },
    },
    footer: {
      variant: variants.footer,
      content: {
        businessName: "Your Business",
        tagline: copy.footerTagline,
        links: [
          { label: "Home", href: "/" },
          { label: "About", href: "/about/" },
          { label: spec.servicesPageName, href: "/services/" },
          { label: "Contact", href: "/contact/" },
        ],
      },
    },
    pages,
  };
}

const SPECS: TemplateSpec[] = [
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Clean, confident and professional — a safe choice for any service business.",
    bestFor: ["Professional services", "Legal", "Other"],
    tags: ["minimal", "clean", "professional", "corporate", "consulting", "agency"],
    theme: {
      primaryColor: "#2563eb",
      accentColor: "#0ea5e9",
      fontHeading: "Space Grotesk",
      fontBody: "Inter",
      radius: "md",
    },
    variants: {
      nav: "simple",
      hero: "split",
      about: "imageLeft",
      services: "list",
      gallery: "grid",
      testimonials: "grid",
      contact: "split",
      footer: "columns",
    },
    servicesPageName: "Services",
    includeGallery: false,
    copy: {
      heroHeadline: "Your business, done right.",
      heroSub: "Tell customers what makes you the obvious choice.",
      heroCta: "Get started",
      aboutHeadline: "About us",
      aboutBody: "Share your story, your experience, and why customers trust you.",
      servicesHeadline: "What we offer",
      services: [
        { title: "Service one", description: "Describe what's included." },
        { title: "Service two", description: "Describe what's included." },
        { title: "Service three", description: "Describe what's included." },
      ],
      testimonialsHeadline: "What clients say",
      testimonials: [
        { quote: "Professional, on time, and worth every penny.", author: "A. Client" },
        { quote: "Couldn't ask for better service.", author: "B. Customer" },
      ],
      contactHeadline: "Get in touch",
      contactDescription: "Tell us what you need and we'll get back to you shortly.",
      footerTagline: "Dependable service, every time.",
    },
  },
  {
    id: "salon-spa",
    name: "Salon & Spa",
    description: "Soft, warm and inviting — made for salons, spas and wellness studios.",
    bestFor: ["Beauty and wellness"],
    tags: ["salon", "spa", "beauty", "hair", "nails", "wellness", "massage", "warm"],
    theme: {
      primaryColor: "#b45309",
      accentColor: "#d97706",
      fontHeading: "Fraunces",
      fontBody: "DM Sans",
      radius: "full",
    },
    variants: {
      nav: "centered",
      hero: "centered",
      about: "stacked",
      services: "cards",
      gallery: "grid",
      testimonials: "spotlight",
      contact: "centered",
      footer: "simple",
    },
    servicesPageName: "Treatments",
    includeGallery: true,
    copy: {
      heroEyebrow: "Welcome",
      heroHeadline: "A space made for you.",
      heroSub: "Come as you are, leave feeling your best.",
      heroCta: "Book a visit",
      aboutHeadline: "Our story",
      aboutBody: "A little about how it all started and what you can expect when you visit.",
      servicesHeadline: "Treatments",
      servicesSub: "Pick what feels right for you today.",
      services: [
        { title: "Signature treatment", description: "A short description here.", price: "$65" },
        { title: "Classic essential", description: "A short description here.", price: "$45" },
        { title: "Deluxe experience", description: "A short description here.", price: "$95" },
      ],
      galleryHeadline: "A look inside",
      testimonialsHeadline: "Loved by our regulars",
      testimonials: [{ quote: "I always leave feeling completely renewed.", author: "R. Regular" }],
      contactHeadline: "Reserve your spot",
      contactDescription: "Book ahead — weekends fill up fast.",
      footerTagline: "Your calm, on your schedule.",
    },
  },
  {
    id: "restaurant-cafe",
    name: "Restaurant & Café",
    description: "Appetising and energetic — built around a menu and great photography.",
    bestFor: ["Restaurant and hospitality"],
    tags: ["restaurant", "cafe", "food", "menu", "bistro", "coffee", "bar", "dining"],
    theme: {
      primaryColor: "#dc2626",
      accentColor: "#facc15",
      fontHeading: "Poppins",
      fontBody: "Inter",
      radius: "sm",
    },
    variants: {
      nav: "simple",
      hero: "centered",
      about: "stacked",
      services: "cards",
      gallery: "featured",
      testimonials: "grid",
      contact: "centered",
      footer: "simple",
    },
    servicesPageName: "Menu",
    includeGallery: true,
    copy: {
      heroEyebrow: "Now open",
      heroHeadline: "Feel the difference.",
      heroSub: "Big flavour, bigger welcome — come see for yourself.",
      heroCta: "See the menu",
      aboutHeadline: "Our kitchen",
      aboutBody: "Tell guests where your ingredients come from and what makes your food yours.",
      servicesHeadline: "Fan favourites",
      services: [
        { title: "Item one", description: "A short, tasty description.", price: "$12" },
        { title: "Item two", description: "A short, tasty description.", price: "$14" },
        { title: "Item three", description: "A short, tasty description.", price: "$10" },
      ],
      galleryHeadline: "From our kitchen",
      testimonialsHeadline: "People are talking",
      testimonials: [
        { quote: "Best in town, hands down.", author: "J. Regular" },
        { quote: "The energy here is unmatched.", author: "K. Fan" },
      ],
      contactHeadline: "Come find us",
      contactDescription: "Walk-ins welcome — book ahead for larger groups.",
      footerTagline: "Good food, good people.",
    },
  },
  {
    id: "dental-clinic",
    name: "Clinic & Dental",
    description: "Calm, clean and reassuring — designed to build trust quickly.",
    bestFor: ["Health and dental"],
    tags: ["clinic", "dental", "dentist", "medical", "health", "doctor", "care", "trust"],
    theme: {
      primaryColor: "#0d9488",
      accentColor: "#38bdf8",
      fontHeading: "DM Sans",
      fontBody: "Inter",
      radius: "lg",
    },
    variants: {
      nav: "simple",
      hero: "split",
      about: "imageLeft",
      services: "cards",
      gallery: "grid",
      testimonials: "grid",
      contact: "split",
      footer: "columns",
    },
    servicesPageName: "Treatments",
    includeGallery: false,
    copy: {
      heroEyebrow: "Accepting new patients",
      heroHeadline: "Care you can feel good about.",
      heroSub: "Gentle, modern treatment from a team that listens.",
      heroCta: "Book an appointment",
      aboutHeadline: "Meet the practice",
      aboutBody: "Introduce your team, your qualifications, and how you look after patients.",
      servicesHeadline: "Treatments we offer",
      services: [
        { title: "Check-ups & cleaning", description: "Routine care to keep things healthy." },
        { title: "Cosmetic treatments", description: "Describe what's available." },
        { title: "Emergency care", description: "Same-day help when it's urgent." },
      ],
      testimonialsHeadline: "What our patients say",
      testimonials: [
        { quote: "The most relaxed I've ever felt at a clinic.", author: "P. Patient" },
        { quote: "Explained everything clearly, no pressure.", author: "S. Visitor" },
      ],
      contactHeadline: "Book an appointment",
      contactDescription: "Call us or request a time and we'll confirm by phone.",
      footerTagline: "Modern care, gentle hands.",
    },
  },
  {
    id: "fitness-studio",
    name: "Fitness Studio",
    description: "Bold and high-energy — for gyms, studios and personal trainers.",
    bestFor: ["Fitness"],
    tags: ["gym", "fitness", "training", "yoga", "pilates", "crossfit", "coach", "bold"],
    theme: {
      primaryColor: "#171717",
      accentColor: "#84cc16",
      fontHeading: "Space Grotesk",
      fontBody: "Inter",
      radius: "none",
    },
    variants: {
      nav: "simple",
      hero: "centered",
      about: "imageLeft",
      services: "cards",
      gallery: "featured",
      testimonials: "spotlight",
      contact: "centered",
      footer: "simple",
    },
    servicesPageName: "Classes",
    includeGallery: true,
    copy: {
      heroEyebrow: "First class free",
      heroHeadline: "Stronger starts here.",
      heroSub: "Small classes, real coaching, results you can measure.",
      heroCta: "Start training",
      aboutHeadline: "Why train with us",
      aboutBody: "Describe your coaching style, your space, and who you help.",
      servicesHeadline: "Classes & memberships",
      services: [
        { title: "Drop-in class", description: "Try any class, no commitment.", price: "$20" },
        { title: "Monthly membership", description: "Unlimited classes.", price: "$99" },
        { title: "Personal training", description: "One-to-one coaching.", price: "$70" },
      ],
      galleryHeadline: "Inside the studio",
      testimonialsHeadline: "Member results",
      testimonials: [{ quote: "Fittest I've been in ten years.", author: "M. Member" }],
      contactHeadline: "Come try a class",
      contactDescription: "Your first session is on us — just turn up.",
      footerTagline: "Show up. Get stronger.",
    },
  },
  {
    id: "home-services",
    name: "Home Services",
    description: "Straightforward and trustworthy — for trades and on-site services.",
    bestFor: ["Home services", "Automotive"],
    tags: ["plumbing", "electrician", "hvac", "cleaning", "trades", "repair", "handyman", "local"],
    theme: {
      primaryColor: "#1d4ed8",
      accentColor: "#f97316",
      fontHeading: "Poppins",
      fontBody: "Inter",
      radius: "sm",
    },
    variants: {
      nav: "simple",
      hero: "split",
      about: "imageLeft",
      services: "list",
      gallery: "grid",
      testimonials: "grid",
      contact: "split",
      footer: "columns",
    },
    servicesPageName: "Services",
    includeGallery: false,
    copy: {
      heroEyebrow: "Same-day callouts",
      heroHeadline: "Fixed properly, first time.",
      heroSub: "Licensed, insured, and straight with you about the price.",
      heroCta: "Request a quote",
      aboutHeadline: "About the team",
      aboutBody: "Say how long you've been going, your area, and what you stand behind.",
      servicesHeadline: "What we handle",
      services: [
        { title: "Repairs", description: "Describe the work you take on." },
        { title: "Installations", description: "Describe the work you take on." },
        { title: "Emergency callouts", description: "Available when it can't wait." },
      ],
      testimonialsHeadline: "From local customers",
      testimonials: [
        { quote: "Turned up on time and charged what he quoted.", author: "D. Homeowner" },
        { quote: "Sorted in an hour. Brilliant.", author: "L. Local" },
      ],
      contactHeadline: "Get a quote",
      contactDescription: "Tell us the job and we'll come back with a price.",
      footerTagline: "Honest work, fair prices.",
    },
  },
  {
    id: "real-estate",
    name: "Real Estate",
    description: "Polished and photo-led — for agents, brokers and property managers.",
    bestFor: ["Real estate"],
    tags: ["property", "realtor", "estate agent", "homes", "listings", "broker", "luxury"],
    theme: {
      primaryColor: "#0f172a",
      accentColor: "#c9a227",
      fontHeading: "Playfair Display",
      fontBody: "DM Sans",
      radius: "sm",
    },
    variants: {
      nav: "centered",
      hero: "centered",
      about: "imageLeft",
      services: "cards",
      gallery: "featured",
      testimonials: "spotlight",
      contact: "split",
      footer: "columns",
    },
    servicesPageName: "Services",
    includeGallery: true,
    copy: {
      heroHeadline: "Find the one.",
      heroSub: "Local expertise and honest advice, from first viewing to keys.",
      heroCta: "Book a valuation",
      aboutHeadline: "Who we are",
      aboutBody: "Describe your patch, your track record and how you work with clients.",
      servicesHeadline: "How we help",
      services: [
        { title: "Selling", description: "Pricing, marketing and negotiation." },
        { title: "Buying", description: "Search, viewings and offers." },
        { title: "Lettings", description: "Tenants, compliance and management." },
      ],
      galleryHeadline: "Recent properties",
      testimonialsHeadline: "Client stories",
      testimonials: [{ quote: "Sold above asking in under two weeks.", author: "V. Vendor" }],
      contactHeadline: "Let's talk",
      contactDescription: "Book a free, no-obligation valuation.",
      footerTagline: "Property, done properly.",
    },
  },
  {
    id: "law-firm",
    name: "Law & Advisory",
    description: "Formal and credible — for legal, accounting and advisory practices.",
    bestFor: ["Legal", "Professional services"],
    tags: ["law", "legal", "solicitor", "attorney", "accountant", "advisory", "finance", "formal"],
    theme: {
      primaryColor: "#1e3a5f",
      accentColor: "#b08d57",
      fontHeading: "Playfair Display",
      fontBody: "Inter",
      radius: "none",
    },
    variants: {
      nav: "simple",
      hero: "split",
      about: "imageLeft",
      services: "list",
      gallery: "grid",
      testimonials: "grid",
      contact: "split",
      footer: "columns",
    },
    servicesPageName: "Practice areas",
    includeGallery: false,
    copy: {
      heroEyebrow: "Established practice",
      heroHeadline: "Clear advice when it matters.",
      heroSub: "Experienced counsel, explained in plain language.",
      heroCta: "Request a consultation",
      aboutHeadline: "Our practice",
      aboutBody: "Outline your background, admissions and the clients you act for.",
      servicesHeadline: "Practice areas",
      services: [
        { title: "Area one", description: "Describe the matters you handle." },
        { title: "Area two", description: "Describe the matters you handle." },
        { title: "Area three", description: "Describe the matters you handle." },
      ],
      testimonialsHeadline: "Client feedback",
      testimonials: [
        { quote: "Clear, calm and completely on top of it.", author: "C. Client" },
        { quote: "Explained my options without the jargon.", author: "T. Client" },
      ],
      contactHeadline: "Request a consultation",
      contactDescription: "Tell us briefly what you need and we'll arrange a call.",
      footerTagline: "Considered advice, clearly given.",
    },
  },
  {
    id: "auto-garage",
    name: "Auto & Garage",
    description: "Practical and punchy — for garages, detailing and vehicle services.",
    bestFor: ["Automotive"],
    tags: ["auto", "garage", "mechanic", "car", "mot", "tyres", "detailing", "workshop"],
    theme: {
      primaryColor: "#b91c1c",
      accentColor: "#0f172a",
      fontHeading: "Space Grotesk",
      fontBody: "Inter",
      radius: "sm",
    },
    variants: {
      nav: "simple",
      hero: "split",
      about: "stacked",
      services: "list",
      gallery: "grid",
      testimonials: "grid",
      contact: "centered",
      footer: "simple",
    },
    servicesPageName: "Services",
    includeGallery: true,
    copy: {
      heroEyebrow: "Booking this week",
      heroHeadline: "Back on the road, fast.",
      heroSub: "Straight-talking mechanics and no surprise bills.",
      heroCta: "Book it in",
      aboutHeadline: "About the garage",
      aboutBody: "Say how long you've been open, your specialisms and your guarantee.",
      servicesHeadline: "What we do",
      services: [
        { title: "Servicing", description: "Routine servicing and checks." },
        { title: "Repairs & diagnostics", description: "Describe your capability." },
        { title: "Tyres & brakes", description: "Fitted while you wait." },
      ],
      galleryHeadline: "In the workshop",
      testimonialsHeadline: "What drivers say",
      testimonials: [
        { quote: "Quoted fairly and finished same day.", author: "R. Driver" },
        { quote: "Wouldn't take my car anywhere else.", author: "N. Regular" },
      ],
      contactHeadline: "Book your car in",
      contactDescription: "Tell us the reg and the problem — we'll take it from there.",
      footerTagline: "Straight answers, solid work.",
    },
  },
  {
    id: "creative-studio",
    name: "Creative Studio",
    description: "Gallery-first and expressive — for photographers, designers and makers.",
    bestFor: ["Professional services", "Other"],
    tags: ["photography", "design", "creative", "portfolio", "studio", "artist", "gallery"],
    theme: {
      primaryColor: "#111827",
      accentColor: "#ec4899",
      fontHeading: "Fraunces",
      fontBody: "DM Sans",
      radius: "md",
    },
    variants: {
      nav: "centered",
      hero: "centered",
      about: "stacked",
      services: "cards",
      gallery: "featured",
      testimonials: "spotlight",
      contact: "centered",
      footer: "simple",
    },
    servicesPageName: "Work",
    includeGallery: true,
    copy: {
      heroHeadline: "Made with care.",
      heroSub: "A small studio doing work we're proud to put our name on.",
      heroCta: "Start a project",
      aboutHeadline: "The studio",
      aboutBody: "Describe your process, your influences and who you like working with.",
      servicesHeadline: "What we make",
      services: [
        { title: "Service one", description: "Describe the work and what's included." },
        { title: "Service two", description: "Describe the work and what's included." },
        { title: "Service three", description: "Describe the work and what's included." },
      ],
      galleryHeadline: "Selected work",
      testimonialsHeadline: "Kind words",
      testimonials: [
        { quote: "They understood the brief immediately.", author: "A. Collaborator" },
      ],
      contactHeadline: "Start a project",
      contactDescription: "Tell us about it — we reply to everything.",
      footerTagline: "Thoughtful work, start to finish.",
    },
  },
];

export const TEMPLATES: TemplateDef[] = SPECS.map(buildTemplate);

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Templates matching an org's industry first, then everything else. */
export function sortedTemplatesFor(industryVertical: string | null | undefined): TemplateDef[] {
  if (!industryVertical) return TEMPLATES;
  const matches = TEMPLATES.filter((t) => t.bestFor.includes(industryVertical));
  const rest = TEMPLATES.filter((t) => !t.bestFor.includes(industryVertical));
  return [...matches, ...rest];
}

/** Free-text search across name, description, industry and tags. */
export function searchTemplates(templates: TemplateDef[], query: string): TemplateDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  return templates.filter((t) =>
    [t.name, t.description, ...t.bestFor, ...t.tags].join(" ").toLowerCase().includes(q),
  );
}

/** Industry values that actually have a template, for the picker's filter chips. */
export function templateIndustries(): string[] {
  return Array.from(new Set(TEMPLATES.flatMap((t) => t.bestFor))).sort();
}

export const PAGE_PRESETS = [
  { id: "about", name: "About" },
  { id: "services", name: "Services" },
  { id: "gallery", name: "Gallery" },
  { id: "contact", name: "Contact" },
  { id: "blank", name: "Blank page" },
] as const;

/** Sections for a newly added page. Reuses the site's own template as the
 * blueprint so a new page still looks like it belongs, rather than dropping
 * the business onto an empty canvas. */
export function buildPageSections(templateId: string, preset: string): SiteSection[] {
  const template = getTemplate(templateId);
  if (!template) return [];

  const matching = template.pages.find((p) => p.slug === preset);
  const home = template.pages.find((p) => p.slug === "");
  const source = matching?.sections ?? home?.sections.slice(0, 1) ?? [];

  const unique = Math.random().toString(36).slice(2, 8);
  return source.map((section, index) => ({
    ...section,
    id: `${preset}-${index}-${unique}`,
  }));
}
