import { docs } from "fumadocs-mdx:collections/server";
import type { InferPageType } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = page.slugs;
  // Built to public/og/docs by scripts/build-images.tsx, one file a page; the docs index is `index`.
  return {
    segments,
    url: `/og/docs/${segments.length > 0 ? segments.join("/") : "index"}.png`,
  };
}
