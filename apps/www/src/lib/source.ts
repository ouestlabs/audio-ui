import { docs } from "fumadocs-mdx:collections/server";
import type { InferPageType } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = page.slugs.length > 0 ? page.slugs : [];
  const path = segments.length > 0 ? `/${segments.join("/")}` : "";
  return {
    segments,
    url: `/og/docs${path}`,
  };
}
