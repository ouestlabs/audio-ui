const siteName = "audio/ui";
export const baseUrl =
  process.env.NODE_ENV === "development" ||
  !process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? new URL("http://localhost:4000")
    : new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);

export const siteConfig = {
  author: Object.freeze({
    github: "https://github.com/lucien-loua",
    name: "Cécé Lucien Loua",
    twitter: "https://x.com/luu_loua",
    url: "https://loua.tech",
  }),
  description:
    "Accessible, composable audio controls for React: headless primitives on npm and styled components for shadcn/ui. Knobs, faders, XY pads, meters, waveforms, timelines, sequencers and piano rolls, ready for AI agents through an MCP server and an agent skill.",

  links: Object.freeze({
    github: "https://github.com/ouestlabs/audio-ui",
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
