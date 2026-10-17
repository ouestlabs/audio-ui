/**
 * The address of every page the site serves from its content, which the build
 * prerenders: Node-only (it reads the content folder), so it lives with the
 * scripts and the Vite config, not in the app.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DOCS = join(import.meta.dirname, "../src/content/docs");

function mdxFiles(dir: string, base = ""): string[] {
  return readdirSync(join(dir, base), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return mdxFiles(dir, path);
      }
      return entry.name.endsWith(".mdx") ? [path] : [];
    }
  );
}

const MDX_EXTENSION = /\.mdx$/;

/** A docs page's address from its file: groups in parentheses and a trailing `index` are not in the URL. */
export function slugsOf(file: string): string[] {
  const parts = file
    .replace(MDX_EXTENSION, "")
    .split("/")
    .filter((part) => !part.startsWith("("));
  return parts.at(-1) === "index" ? parts.slice(0, -1) : parts;
}

/** Every docs page: its file, its slugs and its address. */
export function docsPages() {
  return mdxFiles(DOCS).map((file) => {
    const slugs = slugsOf(file);
    return {
      file,
      path: slugs.length > 0 ? `/docs/${slugs.join("/")}` : "/docs",
      slugs,
    };
  });
}

const WHITESPACE = /\s+/g;

/** The addresses of the component catalog's categories. */
export function categoryPaths(): string[] {
  const registry = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "../src/registry-audio/bases/registry.json"),
      "utf8"
    )
  ) as { categories: { name: string }[] };
  return registry.categories.map(
    (category) =>
      `/components/${category.name.toLowerCase().replace(WHITESPACE, "-")}`
  );
}

/** The files of text a build writes next to the pages, so they are served as static files too. */
export const STATIC_TEXT_PATHS = [
  "/llms.txt",
  "/llms-full.txt",
  "/sitemap.xml",
  "/rss.xml",
  "/robots.txt",
  "/manifest.webmanifest",
];

/** Everything the build prerenders. */
export function prerenderPages() {
  return [
    { path: "/" },
    { path: "/components" },
    ...categoryPaths().map((path) => ({ path })),
    ...docsPages().map(({ path }) => ({ path })),
    ...STATIC_TEXT_PATHS.map((path) => ({
      path,
      prerender: { outputPath: path },
    })),
  ];
}
