import { createFileRoute } from "@tanstack/react-router";
import { source } from "@/lib/docs/content/source";
import { getCategories } from "@/lib/registry/core/registry";
import { getSiteUrl } from "@/lib/seo/seo";

interface Entry {
  lastModified?: Date;
  url: string;
}

/**
 * All published doc routes, including every `/docs/components/base/...` page.
 * Using `getPages()` avoids dropping URLs when two pages share the same
 * `name` in the page tree. `lastModified` comes from the last git commit that
 * touched the page.
 */
function entries(baseUrl: string): Entry[] {
  const docs = new Map<string, Date | undefined>();
  for (const page of source.getPages()) {
    if (page.url !== "/docs" && !page.url.startsWith("http")) {
      docs.set(page.url, page.data.lastModified);
    }
  }
  return [
    ...[
      baseUrl,
      `${baseUrl}/docs`,
      `${baseUrl}/components`,
      `${baseUrl}/about`,
      `${baseUrl}/contact`,
      `${baseUrl}/privacy`,
    ].map((url) => ({
      url,
    })),
    ...[...docs].map(([path, lastModified]) => ({
      lastModified,
      url: `${baseUrl}${path}`,
    })),
    ...getCategories().map((category) => ({
      url: `${baseUrl}/components/${category.name}`,
    })),
  ];
}

function sitemap() {
  const urls = entries(getSiteUrl())
    .map(
      ({ lastModified, url }) =>
        `<url><loc>${url}</loc>${lastModified ? `<lastmod>${lastModified.toISOString()}</lastmod>` : ""}</url>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(sitemap(), {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        }),
    },
  },
});
