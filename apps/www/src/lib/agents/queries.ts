import { closest, searchDocs } from "@/lib/agents/doc-search";
import {
  pickSection,
  sectionNames,
  sectionSlug,
} from "@/lib/agents/doc-sections";
import { siteConfig } from "@/lib/config";
import { processMdxForLLMs, readRawDoc } from "@/lib/docs/content/docs-text";
import { source } from "@/lib/docs/content/source";
import {
  getAllCatalogItems,
  searchCatalog,
} from "@/lib/registry/core/registry";

/**
 * What an agent asks of audio/ui, answered once for the MCP server and the
 * REST API alike: the components, their docs, and the catalog of blocks.
 */

const COMPONENT_DOCS_PREFIX = "components/base/";
const KIND_OF_PATH = /\((\w+)\)/;

/** The spaces a component page belongs to, from its folder. */
export const COMPONENT_KINDS = ["elements", "workstation", "devices"] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

/** Catalog items in one page of results. */
export const CATALOG_PAGE_SIZE = 25;

export function installCommand(name: string) {
  return `npx shadcn@latest add @audio-ui/${name}`;
}

function componentPages() {
  return source
    .getPages()
    .filter((page) => page.slugs.join("/").startsWith(COMPONENT_DOCS_PREFIX));
}

type ComponentPage = ReturnType<typeof componentPages>[number];

function describe(page: ComponentPage) {
  const slug = page.slugs.at(-1) ?? "";
  return {
    description: page.data.description,
    docs: `${siteConfig.url}${page.url}`,
    install: installCommand(slug),
    kind: KIND_OF_PATH.exec(page.path)?.[1],
    name: slug,
    title: page.data.title,
  };
}

/** Every component, or those of one kind. */
export function listComponents(kind?: ComponentKind) {
  return componentPages()
    .map(describe)
    .filter((item) => !kind || item.kind === kind);
}

/** The parts of the component docs that answer a question, best first. */
export async function searchComponentDocs(query: string, limit: number) {
  const pages = await Promise.all(
    componentPages().map(async (page) => ({
      markdown: await readRawDoc(page.path),
      name: page.slugs.at(-1) ?? "",
    }))
  );
  return searchDocs(pages, query, limit).map(
    ({ score: _score, ...hit }) => hit
  );
}

/**
 * One component's docs as markdown: the whole page, or one of its sections.
 * An unknown name answers with the names nearest to it, an unknown section
 * with the sections the page has.
 */
export async function readComponentDocs(name: string, section?: string) {
  const slug = name.trim().toLowerCase();
  const page = componentPages().find((p) => p.slugs.at(-1) === slug);
  if (!page) {
    const names = componentPages().map((p) => p.slugs.at(-1) ?? "");
    return {
      problem: "unknown-component" as const,
      suggestions: closest(name, names),
    };
  }
  const markdown = await processMdxForLLMs(await readRawDoc(page.path));
  const sections = sectionNames(markdown);
  if (!section) {
    return { component: describe(page), markdown, sections };
  }
  const part = pickSection(markdown, sectionSlug(section));
  if (part === undefined) {
    return { problem: "unknown-section" as const, sections, slug };
  }
  return { component: describe(page), markdown: part, sections };
}

/** A page of the catalog's blocks and demos, all of them without a query. */
export function searchCatalogItems(query: string | undefined, offset: number) {
  const items = query?.trim() ? searchCatalog(query) : getAllCatalogItems();
  const page = items.slice(offset, offset + CATALOG_PAGE_SIZE);
  const next = offset + page.length;
  const hasMore = next < items.length;
  return {
    has_more: hasMore,
    items: page.map((item) => ({
      categories: item.categories,
      description: item.description,
      install: installCommand(item.name),
      name: item.name,
      title: item.title,
    })),
    next_offset: hasMore ? next : undefined,
    total: items.length,
  };
}
