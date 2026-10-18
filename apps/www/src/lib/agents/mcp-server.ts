import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

const COMPONENT_DOCS_PREFIX = "components/base/";
const SEARCH_LIMIT = 25;
/** A whole page longer than this is cut, so one call stays a few thousand tokens. */
const CHARACTER_LIMIT = 25_000;

const readOnly = Object.freeze({
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
});

function installCommand(name: string) {
  return `npx shadcn@latest add @audio-ui/${name}`;
}

function componentPages() {
  return source
    .getPages()
    .filter((page) => page.slugs.join("/").startsWith(COMPONENT_DOCS_PREFIX));
}

function text(value: unknown) {
  return {
    content: [
      {
        text: typeof value === "string" ? value : JSON.stringify(value),
        type: "text" as const,
      },
    ],
  };
}

/** Markdown longer than the limit is cut at a line, and the reply says so, with the hint that follows. */
function fitText(markdown: string, hint = "") {
  if (markdown.length <= CHARACTER_LIMIT) {
    return markdown;
  }
  const cut = markdown.lastIndexOf("\n", CHARACTER_LIMIT);
  const head = markdown.slice(0, cut > 0 ? cut : CHARACTER_LIMIT);
  return `${head}\n\n[Truncated: ${markdown.length} characters, the first ${head.length} shown.${hint}]`;
}

export function createAudioUiMcpServer() {
  const server = new McpServer({
    name: "audio-ui-mcp-server",
    title: "audio/ui",
    version: "1.0.0",
    websiteUrl: siteConfig.url,
  });

  server.registerTool(
    "list_components",
    {
      annotations: readOnly,
      description:
        "List every audio/ui component page (controls, displays, workstation parts and devices). Returns an array of { name, title, description, docs, install }; each name works with get_component_docs. Start here to see what exists.",
      inputSchema: {},
      title: "List audio/ui components",
    },
    () =>
      text(
        componentPages().map((page) => {
          const slug = page.slugs.at(-1) ?? "";
          return {
            description: page.data.description,
            docs: `${siteConfig.url}${page.url}`,
            install: installCommand(slug),
            name: slug,
            title: page.data.title,
          };
        })
      )
  );

  server.registerTool(
    "get_component_docs",
    {
      annotations: readOnly,
      description:
        "Get the documentation of one audio/ui component as markdown: installation, API, props, accessibility, examples and the source to copy. Use a name from list_components (for example 'knob' or 'piano-roll'). Pass a section (for example 'installation' or 'api-reference') to get only that part. Returns markdown; an unknown name or section returns an error that lists the valid choices.",
      inputSchema: {
        name: z
          .string()
          .describe("Component slug from list_components, e.g. 'knob'."),
        section: z
          .string()
          .optional()
          .describe(
            "One section of the page, e.g. 'installation', 'usage' or 'api-reference'. Empty returns the whole page."
          ),
      },
      title: "Get component docs",
    },
    async ({ name, section }) => {
      const slug = name.trim().toLowerCase();
      const page = componentPages().find((p) => p.slugs.at(-1) === slug);

      if (!page) {
        const known = componentPages()
          .map((p) => p.slugs.at(-1))
          .join(", ");
        return {
          ...text(`No component named '${name}'. Available: ${known}.`),
          isError: true,
        };
      }

      const markdown = await processMdxForLLMs(await readRawDoc(page.path));
      if (!section) {
        return text(
          fitText(
            markdown,
            ` Call again with section set to one of: ${sectionNames(markdown).join(", ")}.`
          )
        );
      }
      const part = pickSection(markdown, sectionSlug(section));
      if (part === undefined) {
        return {
          ...text(
            `No section '${section}' in ${slug}. Sections: ${sectionNames(markdown).join(", ")}.`
          ),
          isError: true,
        };
      }
      return text(fitText(part));
    }
  );

  server.registerTool(
    "search_catalog",
    {
      annotations: readOnly,
      description:
        "Search the audio/ui catalog of ready-made blocks and demos (players, synth panels, mixers, piano rolls, wave shapers). Returns up to 25 items per page with their name, categories and install command; leave the query empty to list everything. Returns items, total, has_more and next_offset: when has_more is true, call again with offset set to next_offset.",
      inputSchema: {
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Items to skip. Use the next_offset of the previous page."),
        query: z
          .string()
          .optional()
          .describe("Words like 'synth', 'player', 'xypad'. Empty lists all."),
      },
      title: "Search the catalog",
    },
    ({ offset, query }) => {
      const items = query?.trim() ? searchCatalog(query) : getAllCatalogItems();
      const page = items.slice(offset, offset + SEARCH_LIMIT);
      const next = offset + page.length;
      const hasMore = next < items.length;
      return text({
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
      });
    }
  );

  return server;
}
