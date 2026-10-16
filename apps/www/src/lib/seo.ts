import type { Metadata } from "next";

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

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: Metadata["keywords"];
  robots?: Metadata["robots"];
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

export function getSiteAuthors(): NonNullable<Metadata["authors"]> {
  return [
    {
      name: siteConfig.author.name,
      url: siteConfig.author.url,
    },
    {
      name: siteConfig.name,
      url: siteConfig.url,
    },
  ];
}

export function buildPageSocialMetadata({
  title,
  description,
  path,
  type = "website",
  image,
}: Pick<
  PageMetadataOptions,
  "title" | "description" | "path" | "type" | "image"
>): Pick<Metadata, "openGraph" | "twitter"> {
  // Explicit fallback to the generated /opengraph-image route: Next 16 stopped
  // injecting the og:image tag from the file convention (the route itself still
  // works), so relying on inheritance ships pages without any og:image.
  const imageUrl = getAbsoluteMetadataUrl(image ?? "/opengraph-image");
  const twitterCreator = getSocialHandle(siteConfig.links.twitter);
  // The generated image is 1200×630 (`size` in app/opengraph-image.tsx); a page's own image has no known size.
  const imageSize = image ? {} : { height: 630, width: 1200 };

  return {
    openGraph: {
      description,
      images: [{ url: imageUrl, ...imageSize }],
      locale: siteConfig.metadata.locale,
      siteName: siteConfig.name,
      title,
      type,
      url: getAbsoluteMetadataUrl(path),
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: [{ url: imageUrl }],
      title,
      ...(twitterCreator ? { creator: twitterCreator } : {}),
    },
  };
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  robots,
  type = "website",
  titleSuffix,
  image,
}: PageMetadataOptions): Metadata {
  const resolvedTitle = titleSuffix ? `${title} - ${titleSuffix}` : title;

  return {
    alternates: {
      canonical: path,
      types: {
        "application/rss+xml": [
          { title: `${siteConfig.name} Docs`, url: "/rss.xml" },
        ],
        "text/plain": [{ title: "llms.txt", url: "/llms.txt" }],
        // Every docs page is also served as markdown, which agents read better than HTML.
        ...(path === "/docs" || path.startsWith("/docs/")
          ? {
              "text/markdown": [{ url: path.replace("/docs", "/llm") }],
            }
          : {}),
      },
    },
    description,
    title: resolvedTitle,
    ...(keywords ? { keywords } : {}),
    ...(robots ? { robots } : {}),
    ...buildPageSocialMetadata({
      description,
      image,
      path,
      title,
      type,
    }),
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
    logo: absoluteUrl("/icon"),
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
