const siteName = "audio/ui";
export const baseUrl =
  process.env.NODE_ENV === "development" ||
  !process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? new URL("http://localhost:4000")
    : new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);

export const siteConfig = {
  description:
    "A set of accessible and composable Audio UI components. Built on top of shadcn/ui, it's designed for you to copy, paste, and own.",

  links: Object.freeze({
    github: "https://github.com/ouestlabs/audio-ui",
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
