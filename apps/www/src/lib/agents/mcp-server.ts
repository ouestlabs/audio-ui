import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  COMPONENT_KINDS,
  listComponents,
  readComponentDocs,
  searchCatalogItems,
  searchComponentDocs,
} from "@/lib/agents/queries";
import { siteConfig } from "@/lib/config";

/** A whole page longer than this is cut, so one call stays a few thousand tokens. */
const CHARACTER_LIMIT = 25_000;
const DOC_HITS = 8;

const INSTRUCTIONS =
  "audio/ui is a React library of audio interface components: elements (knob, fader, meter, piano), workstation parts (timeline, piano roll, mixer) and devices (compressor, reverb, synth). To find something, call search_docs with the question in plain words, or list_components to browse. Then call get_component_docs with the component and the section the hit names: fetch one section, not the whole page, which can be 100 KB. Every result carries the command that installs the component. Use search_catalog for a ready-made block, such as a device panel or a mixer.";

const readOnly = Object.freeze({
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
});

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

/**
 * The docs an agent most likely asked for: a name within two edits of one
 * component answers that component, and an unknown section the page's
 * overview, or its first section. Each stand-in adds a note that says so.
 */
async function readNearestDocs(name: string, section?: string) {
  const notes: string[] = [];
  let docs = await readComponentDocs(name, section);
  if (docs.problem === "unknown-component" && docs.nearest) {
    notes.push(
      `No component named '${name}'. Showing docs for '${docs.nearest}' instead.`
    );
    docs = await readComponentDocs(docs.nearest, section);
  }
  if (docs.problem === "unknown-section") {
    const shown = docs.sections.includes("overview")
      ? "overview"
      : docs.sections[0];
    notes.push(
      `Section '${section}' not found in ${docs.slug}. Showing ${shown ?? "the whole page"} instead. Available sections: ${docs.sections.join(", ")}.`
    );
    docs = await readComponentDocs(docs.slug, shown);
  }
  return { docs, notes };
}

export function createAudioUiMcpServer() {
  const server = new McpServer(
    {
      name: "audio-ui-mcp-server",
      title: "audio/ui",
      version: "1.0.0",
      websiteUrl: siteConfig.url,
    },
    { instructions: INSTRUCTIONS }
  );

  server.registerTool(
    "list_components",
    {
      annotations: readOnly,
      description:
        "List the audio/ui component pages, optionally one kind: elements, workstation or devices. Returns an array of { name, kind, title, description, docs, install }; each name works with get_component_docs. To find a component by what it does, use search_docs instead.",
      inputSchema: {
        kind: z
          .enum(COMPONENT_KINDS)
          .optional()
          .describe(
            "Only this kind: elements (knob, fader, meter, piano), workstation (timeline, piano roll, mixer) or devices (compressor, reverb, synth). Empty lists all."
          ),
      },
      title: "List audio/ui components",
    },
    ({ kind }) => text(listComponents(kind))
  );

  server.registerTool(
    "search_docs",
    {
      annotations: readOnly,
      description:
        "Search the text of the audio/ui component docs, such as 'log scale frequency knob' or 'drag handle on a plot'. Returns hits as { component, section, heading, snippet }, best first; pass component and section to get_component_docs to read that part. Returns an empty list when nothing matches.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(DOC_HITS)
          .describe("Hits to return, 1 to 20."),
        query: z
          .string()
          .min(2)
          .describe("Words about what you want to build or understand."),
      },
      title: "Search the docs",
    },
    async ({ limit, query }) => {
      const hits = await searchComponentDocs(query, limit);
      return text(
        hits.length > 0
          ? { hits, total: hits.length }
          : {
              hint: "Nothing matched. Try fewer or different words, or browse with list_components.",
              hits,
              total: 0,
            }
      );
    }
  );

  server.registerTool(
    "get_component_docs",
    {
      annotations: readOnly,
      description:
        "Get the documentation of one audio/ui component as markdown: installation, API, props, accessibility, examples and the source to copy. Use a name from list_components (for example 'knob' or 'piano-roll'). Pass a section to get only that part: every page has 'installation', and the others differ by page (a device's page has no 'api-reference'). Returns markdown. A name within two edits of exactly one component, such as 'pianoroll', returns that component; an unknown section returns the page's overview, or its first section, and lists the page's sections. Either reply starts with a note that says what is shown instead. Any other unknown name returns an error with the nearest names.",
      inputSchema: {
        name: z
          .string()
          .describe("Component slug from list_components, e.g. 'knob'."),
        section: z
          .string()
          .optional()
          .describe(
            "One section of the page, e.g. 'installation', which every page has. The others differ by page: an unknown one returns the overview, or the first section, with the page's list. Empty returns the whole page."
          ),
      },
      title: "Get component docs",
    },
    async ({ name, section }) => {
      const { docs, notes } = await readNearestDocs(name, section);
      if ("problem" in docs) {
        const message =
          docs.problem === "unknown-component"
            ? `No component named '${name}'. ${docs.suggestions.length > 0 ? `Did you mean: ${docs.suggestions.join(", ")}? ` : ""}Use search_docs to find a component by what it does, or list_components to browse.`
            : `No section '${section}' in ${docs.slug}. Sections: ${docs.sections.join(", ")}.`;
        return { ...text(message), isError: true };
      }
      const markdown = section
        ? fitText(docs.markdown)
        : fitText(
            docs.markdown,
            ` Call again with section set to one of: ${docs.sections.join(", ")}.`
          );
      return text(
        notes.length > 0 ? `${notes.join("\n")}\n\n${markdown}` : markdown
      );
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
    ({ offset, query }) => text(searchCatalogItems(query, offset))
  );

  return server;
}
