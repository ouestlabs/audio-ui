const siteName = "audio/ui";
export const baseUrl =
  process.env.NODE_ENV === "development" ||
  !process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? new URL("http://localhost:4000")
    : new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);

export const siteConfig = {
  name: siteName,
  url: baseUrl.origin,
  description:
    "A set of accessible and composable Audio UI components. Built on top of shadcn/ui, it's designed for you to copy, paste, and own.",
  metadata: {
    locale: "en_US",
    titleTemplate: "%s",
    titleSuffixes: {
      site: siteName,
      componentCategory: "UI Components",
    },
  },

  links: Object.freeze({
    twitter: "https://x.com/ouestlabs",
    github: "https://github.com/ouestlabs/audio-ui",
  }),
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
};

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#09090b",
};
