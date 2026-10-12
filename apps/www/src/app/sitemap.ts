import type { MetadataRoute } from "next";

import { getCategories } from "@/lib/registry";
import { getSiteUrl } from "@/lib/seo";
import { source } from "@/lib/source";

/**
 * All published doc routes (same set as `source.generateParams()`), including
 * every `/docs/components/base/...` page. Using `getPages()` avoids
 * dropping URLs when two pages share the same `name` in the page tree.
 * `lastModified` comes from the last git commit that touched the page.
 */
function collectDocEntries(baseUrl: string): MetadataRoute.Sitemap {
  const entries = new Map<string, Date | undefined>();
  for (const page of source.getPages()) {
    if (page.url !== "/docs" && !page.url.startsWith("http")) {
      entries.set(page.url, page.data.lastModified);
    }
  }
  return [...entries].map(([path, lastModified]) => ({
    lastModified,
    url: `${baseUrl}${path}`,
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();

  const staticPaths = [baseUrl, `${baseUrl}/docs`, `${baseUrl}/components`];

  const componentCategoryPaths = getCategories().map(
    (category) => `${baseUrl}/components/${category.name}`
  );

  return [
    ...staticPaths.map((url) => ({ url })),
    ...collectDocEntries(baseUrl),
    ...componentCategoryPaths.map((url) => ({ url })),
  ];
}
