import type { Metadata } from "next";

import { siteConfig } from "@/lib/config";
import { getCategoryDocsDescription } from "@/lib/registry";

const CANONICAL_COMPONENT_DOC_SLUGS = [
  "player",
  "knob",
  "fader",
  "xypad",
  "transport",
  "channel-strip",
  "sortable-list",
] as const;

const TRAILING_SLASH_REGEX = /\/$/;
// Accidental env concat (e.g. https://audio-ui.xyzhttps://other.example)
const DOUBLE_ORIGIN_REGEX = /^(https?:\/\/[^/]+)(https?:\/\/)/i;

function normalizeSiteUrl(url: string) {
  const trimmed = url.trim();
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  // Accidental env concat (e.g. https://audio-ui.xyzhttps://other.example) → first origin only
  const m = withProtocol.match(DOUBLE_ORIGIN_REGEX);
  if (m) {
    return m[1].replace(TRAILING_SLASH_REGEX, "");
  }

  return withProtocol.replace(TRAILING_SLASH_REGEX, "");
}

export type CanonicalComponentDocSlug =
  (typeof CANONICAL_COMPONENT_DOC_SLUGS)[number];

export function getSiteUrl() {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      siteConfig.url
  );
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
    const handle = socialUrl.pathname.split("/").filter(Boolean)[0];
    return handle ? `@${handle}` : undefined;
  } catch {}
}

function getAbsoluteMetadataUrl(path: string) {
  return path.startsWith("http://") || path.startsWith("https://")
    ? path
    : absoluteUrl(path);
}

export function getSiteAuthors(): NonNullable<Metadata["authors"]> {
  return [
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

  return {
    openGraph: {
      description,
      images: [{ url: imageUrl }],
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
 * audio/ui ships Base UI only today; `base` is kept for a future Radix variant.
 */
export function getComponentDocSeo(
  slug: CanonicalComponentDocSlug,
  label: string,
  base: "base" | "radix",
  docDescription?: string | null
): ComponentDocSeo {
  const canonicalPath = `/docs/components/${base}/${slug}`;
  const displayTitle = label;

  const docHook = docDescription?.trim() ?? "";
  const leadDescription = docHook || `${label} component for audio/ui.`;

  const registryDesc = getCategoryDocsDescription(slug);
  const title = label;

  const description = registryDesc
    ? `${label} for React and Tailwind CSS, built on top of shadcn/ui. ${registryDesc}`
    : `${label} for React and Tailwind CSS, built on top of shadcn/ui. ${docHook || getGenericComponentDocDescription(label)}`;

  return {
    canonicalPath,
    description: description.replace(/\s+/g, " ").trim(),
    displayTitle,
    leadDescription,
    shouldIndex: base === "base",
    title,
  };
}

/**
 * Docs catalog CTA intro shown at the bottom of a component doc page.
 * audio/ui ships Base UI only today; `base` is kept for a future Radix variant.
 */
export function getDocsComponentCatalogIntro(
  _slug: CanonicalComponentDocSlug,
  label: string,
  count: number,
  base: "base" | "radix"
): string {
  const p = count;
  const variantLine =
    base === "radix"
      ? "These examples follow the Radix UI implementation with accessible primitives from the Radix stack"
      : "These examples use Base UI primitives from @base-ui/react";

  return `Browse ${p} production-ready audio/ui ${label} components for players, mixers, and synth interfaces. ${variantLine} and stay fully compatible with Shadcn Create so radius, color, and typography match your configured theme.`;
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
    logo: absoluteUrl("/icon"),
    name: siteConfig.name,
    sameAs: [siteConfig.links.github, siteConfig.links.twitter],
    url: getSiteUrl(),
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description: siteConfig.description,
    name: siteConfig.name,
    potentialAction: {
      "@type": "SearchAction",
      "query-input": "required name=search_term_string",
      target: absoluteUrl("/components?search={search_term_string}"),
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: getSiteUrl(),
    },
    url: getSiteUrl(),
  };
}
