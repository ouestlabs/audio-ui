const siteName = "audio/ui";
// The canonical origin is fixed, so no deployment setting can point canonical
// and Open Graph URLs at another domain.
export const baseUrl =
  process.env.NODE_ENV === "development"
    ? new URL("http://localhost:4000")
    : new URL("https://www.audio-ui.dev");

export const siteConfig = {
  author: Object.freeze({
    github: "https://github.com/lucien-loua",
    name: "Cécé Lucien Loua",
    twitter: "https://x.com/luu_loua",
    url: "https://loua.tech",
  }),
  description:
    "Audio controls for React: knobs, faders, meters, waveforms, timelines, sequencers and piano rolls, as headless primitives on npm or shadcn/ui components.",
  /** Ouest Labs' public address, as on its GitHub profile. */
  email: "contact.ouest.labs@gmail.com",

  links: Object.freeze({
    github: "https://github.com/ouestlabs/audio-ui",
    lab: "https://lab.audio-ui.dev",
    npm: "https://www.npmjs.com/package/@audio-ui/react",
    twitter: "https://x.com/ouestlabs",
  }),
  metadata: {
    locale: "en_US",
    titleSuffixes: {
      componentCategory: "UI Components",
      site: siteName,
    },
    titleTemplate: "%s",
  },
  name: siteName,
  navItems: [
    {
      href: "/components",
      label: "Components",
    },
    {
      href: "/docs",
      label: "Docs",
    },
  ],
  url: baseUrl.origin,
};

export const META_THEME_COLORS = {
  dark: "#09090b",
  light: "#ffffff",
};
