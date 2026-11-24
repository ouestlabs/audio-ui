import { siteConfig } from "@/lib/config";

/**
 * Stands in for the site's `@/lib/seo/seo`, which `@/lib/utils` imports for
 * one function: the real module loads the whole registry through Vite's
 * `import.meta.glob`, which webpack has no answer for.
 */
export function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${siteConfig.url}/`).toString();
}
