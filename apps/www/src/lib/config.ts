export const baseUrl =
  process.env.NODE_ENV === "development" ||
  !process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? new URL("http://localhost:3000")
    : new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);

export const appConfig = Object.freeze({
  name: "audio/ui",
  url: baseUrl.origin,
  ogImage: `${baseUrl.origin}/opengraph-image.png`,
  description:
    "A set of accessible and composable Audio UI components. Built on top of shadcn/ui, it's designed for you to copy, paste, and own.",
  links: Object.freeze({
    twitter: "https://x.com/ouestlabs",
    github: "https://github.com/ouestlabs/audio-ui",
  }),
  navItems: [
    {
      href: "/docs",
      label: "Docs",
    },
    {
      href: "/blocks",
      label: "Blocks",
    },
  ],
});

export function absoluteUrl(path: string) {
  return `${baseUrl.origin}${path}`;
}
