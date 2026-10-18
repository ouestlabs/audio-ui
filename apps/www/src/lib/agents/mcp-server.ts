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

export function createAudioUiMcpServer() {
  const server = new McpServer({
    name: "audio-ui",
    title: "audio/ui",
    version: "1.0.0",
    websiteUrl: siteConfig.url,
  });

  server.registerTool(
    "list_components",
    {
      annotations: readOnly,
      description:
        "List every audio/ui component page (controls, displays, workstation parts and devices) with its summary, docs URL and install command. Each name works with get_component_docs. Start here to see what exists.",
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
        "Get the documentation of one audio/ui component as markdown: installation, API, props, accessibility, examples and the source to copy. Use a name from list_components (for example 'knob' or 'piano-roll'). Pass a section (for example 'installation' or 'api-reference') to get only that part.",
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
        return text(markdown);
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
      return text(part);
    }
  );

  server.registerTool(
    "search_catalog",
    {
      annotations: readOnly,
      description:
        "Search the audio/ui catalog of ready-made blocks and demos (players, synth panels, mixers, piano rolls, wave shapers). Returns names with their install command; leave the query empty to list everything.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Words like 'synth', 'player', 'xypad'. Empty lists all."),
      },
      title: "Search the catalog",
    },
    ({ query }) => {
      const items = query?.trim() ? searchCatalog(query) : getAllCatalogItems();
      return text({
        items: items.slice(0, SEARCH_LIMIT).map((item) => ({
          categories: item.categories,
          description: item.description,
          install: installCommand(item.name),
          name: item.name,
          title: item.title,
        })),
        total: items.length,
      });
    }
  );

  return server;
}
