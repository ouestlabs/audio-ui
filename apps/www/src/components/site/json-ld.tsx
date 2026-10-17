import { stringifyJsonLd } from "@/lib/seo/json-ld";

interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * Structured data for search engines. The script sits inside a hidden div's
 * HTML: React hydrates the div alone, so the scripts that analytics inject
 * into the page before hydration cannot shift it out of place.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: a <script> element would be hydrated by position, and injected third-party scripts break that; the JSON is our own, with "<" escaped
      dangerouslySetInnerHTML={{
        __html: `<script type="application/ld+json">${stringifyJsonLd(data)}</script>`,
      }}
      hidden
      suppressHydrationWarning
    />
  );
}
