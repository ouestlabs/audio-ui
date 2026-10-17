import { siteConfig } from "@/lib/config";
import { getCategoryDocsDescription } from "@/lib/registry";

const CANONICAL_COMPONENT_DOC_SLUGS = [
  "compressor",
  "equalizer",
  "delay",
  "reverb",
  "filter",
  "distortion",
  "chorus",
  "pocket-synth",
  "wave-shaper",
  "utility",
  "limiter",
  "gate",
  "saturator",
  "phaser",
  "auto-pan",
  "channel-eq",
  "overdrive",
  "deesser",
  "multiband",
  "transient",
  "mid-side",
  "redux",
  "envelope",
  "fader",
  "knob",
  "meter",
  "mixer",
  "pad",
  "piano",
  "piano-roll",
  "plot",
  "scrubber",
  "sequencer",
  "spectrum-analyzer",
  "timeline",
  "transport",
  "tuner",
  "waveform",
  "xypad",
  "scale-menu",
  "note-find",
  "note-edit-menu",
  "arrangement-editor",
] as const;

export type CanonicalComponentDocSlug =
  (typeof CANONICAL_COMPONENT_DOC_SLUGS)[number];

export function getSiteUrl() {
  return siteConfig.url;
}

export function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${getSiteUrl()}/`).toString();
}

/** A route's `head()`: the tags of the document's head, as TanStack Router takes them. */
export interface PageHead {
  links: Record<string, string>[];
  meta: Record<string, string>[];
}

/** What every page tells the crawlers: indexed, followed, with large previews. */
export const DEFAULT_ROBOTS =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: readonly string[];
  /** The content of the robots tag, such as `"noindex"`. */
  robots?: string;
  type?: "website" | "article";
  titleSuffix?: string;
  /** Overrides the auto-generated /og image (e.g. a per-doc /og/docs/{slug} image). */
  image?: string;
};

function getSocialHandle(url: string) {
  try {
    const socialUrl = new URL(url);
    const [handle] = socialUrl.pathname.split("/").filter(Boolean);
    return handle ? `@${handle}` : undefined;
  } catch {
    // A malformed social URL has no handle to show.
  }
}

function getAbsoluteMetadataUrl(path: string) {
  return path.startsWith("http://") || path.startsWith("https://")
    ? path
    : absoluteUrl(path);
}

/** The tags that name the site's authors. */
export function getSiteAuthors(): Record<string, string>[] {
  return [
    { content: siteConfig.author.name, name: "author" },
    { content: siteConfig.name, name: "publisher" },
    { content: siteConfig.name, name: "creator" },
  ];
}

/** The Open Graph and Twitter tags of a page. */
export function buildPageSocialMetadata({
  title,
  description,
  path,
  type = "website",
  image,
}: Pick<
  PageMetadataOptions,
  "title" | "description" | "path" | "type" | "image"
>): Record<string, string>[] {
  // The page names its og:image itself, the home's image when it has none of its own.
  const imageUrl = getAbsoluteMetadataUrl(image ?? "/og/home.png");
  const twitterCreator = getSocialHandle(siteConfig.links.twitter);
  // The generated image is 1200×630; a page's own image has no known size.
  const imageSize = image
    ? []
    : [
        { content: "1200", property: "og:image:width" },
        { content: "630", property: "og:image:height" },
      ];

  return [
    { content: title, property: "og:title" },
    { content: description, property: "og:description" },
    { content: getAbsoluteMetadataUrl(path), property: "og:url" },
    { content: siteConfig.name, property: "og:site_name" },
    { content: siteConfig.metadata.locale, property: "og:locale" },
    { content: type, property: "og:type" },
    { content: imageUrl, property: "og:image" },
    ...imageSize,
    { content: "summary_large_image", name: "twitter:card" },
    { content: title, name: "twitter:title" },
    { content: description, name: "twitter:description" },
    { content: imageUrl, name: "twitter:image" },
    ...(twitterCreator
      ? [{ content: twitterCreator, name: "twitter:creator" }]
      : []),
  ];
}

/** The title, description, canonical address, alternates and social tags of a page. */
export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  robots,
  type = "website",
  titleSuffix,
  image,
}: PageMetadataOptions): PageHead {
  const resolvedTitle = titleSuffix ? `${title} - ${titleSuffix}` : title;

  return {
    links: [
      { href: getAbsoluteMetadataUrl(path), rel: "canonical" },
      {
        href: "/rss.xml",
        rel: "alternate",
        title: `${siteConfig.name} Docs`,
        type: "application/rss+xml",
      },
      {
        href: "/llms.txt",
        rel: "alternate",
        title: "llms.txt",
        type: "text/plain",
      },
      // Every docs page is also served as markdown, which agents read better than HTML.
      ...(path === "/docs" || path.startsWith("/docs/")
        ? [
            {
              href: path.replace("/docs", "/llm"),
              rel: "alternate",
              type: "text/markdown",
            },
          ]
        : []),
    ],
    meta: [
      { title: resolvedTitle },
      { content: description, name: "description" },
      ...(keywords ? [{ content: keywords.join(", "), name: "keywords" }] : []),
      ...(robots ? [{ content: robots, name: "robots" }] : []),
      ...buildPageSocialMetadata({
        description,
        image,
        path,
        title,
        type,
      }),
    ],
  };
}

export function isCanonicalComponentDoc(
  slug?: string
): slug is CanonicalComponentDocSlug {
  return !!slug && CANONICAL_COMPONENT_DOC_SLUGS.includes(slug as any);
}

function getGenericComponentDocDescription(label: string) {
  return `Install the open-source shadcn/ui ${label.toLowerCase()} component for React and Tailwind CSS with audio/ui examples, CLI setup, and API guidance.`;
}

export interface ComponentDocSeo {
  canonicalPath: string;
  description: string;
  /** Visible H1 and breadcrumb: the plain component label (e.g. "Knob") */
  displayTitle: string;
  /** Subtitle shown under the H1: the original MDX description, if any */
  leadDescription: string;
  shouldIndex: boolean;
  title: string;
}

/**
 * SEO + on-page copy for canonical component docs (`/docs/components/base/...`).
 */
export function getComponentDocSeo(
  slug: CanonicalComponentDocSlug,
  label: string,
  base: "base",
  docDescription?: string | null
): ComponentDocSeo {
  const canonicalPath = `/docs/components/${base}/${slug}`;
  const displayTitle = label;

  const docHook = docDescription?.trim() ?? "";
  const leadDescription = docHook || `${label} component for audio/ui.`;

  const registryDesc = getCategoryDocsDescription(slug);
  const title = `${label} component for React`;

  const description = registryDesc
    ? `${label} for React and Tailwind CSS, built on top of shadcn/ui. ${registryDesc}`
    : `${label} for React and Tailwind CSS, built on top of shadcn/ui. ${docHook || getGenericComponentDocDescription(label)}`;

  return {
    canonicalPath,
    description: description.replace(/\s+/g, " ").trim(),
    displayTitle,
    leadDescription,
    shouldIndex: true,
    title,
  };
}

/**
 * Docs catalog CTA intro shown at the bottom of a component doc page.
 */
export function getDocsComponentCatalogIntro(
  _slug: CanonicalComponentDocSlug,
  label: string,
  count: number
): string {
  const p = count;

  return `Browse ${p} production-ready audio/ui ${label} components for players, mixers, and synth interfaces. These examples use the headless primitives from @audio-ui/react and stay fully compatible with Shadcn Create so radius, color, and typography match your configured theme.`;
}

type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: absoluteUrl(item.path),
      name: item.name,
      position: index + 1,
    })),
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${getSiteUrl()}/#organization`,
    founder: { "@id": `${getSiteUrl()}/#author` },
    knowsAbout: [
      "React",
      "Web Audio API",
      "Audio user interfaces",
      "Accessibility",
      "shadcn/ui",
      "Tailwind CSS",
    ],
    logo: absoluteUrl("/icon.png"),
    name: siteConfig.name,
    sameAs: [siteConfig.links.github, siteConfig.links.twitter],
    url: getSiteUrl(),
  };
}

export function buildAuthorJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${getSiteUrl()}/#author`,
    jobTitle: "UX/UI developer",
    name: siteConfig.author.name,
    sameAs: [siteConfig.author.github, siteConfig.author.twitter],
    url: siteConfig.author.url,
  };
}

/** The npm package as software, so engines and agents can tie it to the repo, license and author. */
export function buildSoftwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    "@id": `${getSiteUrl()}/#software`,
    author: { "@id": `${getSiteUrl()}/#author` },
    codeRepository: siteConfig.links.github,
    description: siteConfig.description,
    license: "https://opensource.org/licenses/MIT",
    name: "@audio-ui/react",
    programmingLanguage: "TypeScript",
    runtimePlatform: "React 19",
    sameAs: [siteConfig.links.npm],
    url: getSiteUrl(),
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${getSiteUrl()}/#website`,
    description: siteConfig.description,
    inLanguage: "en",
    name: siteConfig.name,
    potentialAction: {
      "@type": "SearchAction",
      "query-input": "required name=search_term_string",
      target: absoluteUrl("/components?search={search_term_string}"),
    },
    publisher: { "@id": `${getSiteUrl()}/#organization` },
    url: getSiteUrl(),
  };
}
