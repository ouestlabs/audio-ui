export const SITE = Object.freeze({
  description:
    "Interactive audio interfaces built with audio/ui: synths, mixers and devices that run on the real components, with Web Audio.",
  locale: "en_US",
  name: "audio/ui lab",
  themeColor: "#0c0b0a",
  twitter: "@ouestlabs",
  url: "https://lab.audio-ui.dev",
});

const ROBOTS =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

export const absoluteUrl = (path: string) =>
  new URL(path.startsWith("/") ? path : `/${path}`, `${SITE.url}/`).toString();

interface PageOptions {
  description: string;
  /** The page's own social image; the lab's default when it has none. */
  image?: string;
  /** The content of the robots tag, such as `"noindex"`. */
  robots?: string;
  /** Not the whole title: the lab's name follows it. */
  title: string;
}

/** A route's `head()` tags: title, description, canonical address and social cards. */
export function pageHead(path: string, options: PageOptions) {
  const title = `${options.title} | ${SITE.name}`;
  const url = absoluteUrl(path);
  const image = absoluteUrl(options.image ?? "/og/default.png");
  return {
    links: [{ href: url, rel: "canonical" }],
    meta: [
      { title },
      { content: options.description, name: "description" },
      { content: options.robots ?? ROBOTS, name: "robots" },
      { content: title, property: "og:title" },
      { content: options.description, property: "og:description" },
      { content: url, property: "og:url" },
      { content: SITE.name, property: "og:site_name" },
      { content: SITE.locale, property: "og:locale" },
      { content: "website", property: "og:type" },
      { content: image, property: "og:image" },
      { content: "summary_large_image", name: "twitter:card" },
      { content: title, name: "twitter:title" },
      { content: options.description, name: "twitter:description" },
      { content: image, name: "twitter:image" },
      { content: SITE.twitter, name: "twitter:site" },
    ],
  };
}

/** A JSON-LD block as a head script: `<` is escaped so the data cannot close the tag. */
export function jsonLd(data: Record<string, unknown>) {
  return {
    children: JSON.stringify(data).replace(/</g, "\\u003c"),
    type: "application/ld+json",
  };
}

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  description: SITE.description,
  name: SITE.name,
  publisher: {
    "@type": "Organization",
    name: "audio/ui",
    url: "https://www.audio-ui.dev",
  },
  url: SITE.url,
};
