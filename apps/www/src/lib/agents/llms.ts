import { siteConfig } from "@/lib/config";
import { source } from "@/lib/docs/content/source";
import { getDocsSpaces, type SpacePage } from "@/lib/docs/content/spaces";
import { getAllCatalogItems } from "@/lib/registry/core/registry";

function markdownUrl(url: string) {
  return `${siteConfig.url}${url.replace("/docs", "/llm")}`;
}

/** `/llms.txt`: the docs by space, for agents to start from. */
export function getLlmsTxt() {
  const spaces = getDocsSpaces();
  // A guide a space opens with, such as Devices, is listed in that space only.
  const inSpaces = new Set(
    spaces.flatMap((space) =>
      space.sections.flatMap((section) => section.pages.map((p) => p.url))
    )
  );
  const guides = source
    .getPages()
    .filter(
      (p) =>
        !(p.slugs.join("/").startsWith("components") || inSpaces.has(p.url))
    )
    .map((p) => ({
      description: p.data.description ?? "",
      title: p.data.title,
      url: p.url,
    }));

  const line = (p: SpacePage) =>
    `- [${p.title}](${markdownUrl(p.url)}): ${p.description}`;

  const body = [
    "# audio/ui",
    `> ${siteConfig.description}`,
    [
      "audio/ui has two layers. `@audio-ui/react` (npm) holds headless, accessible primitives. The `@audio-ui` shadcn registry holds styled components and ready blocks that you copy into your project and own. Requires React 19; the registry also needs Tailwind CSS v4.",
      "",
      "- Install a component: `npx shadcn@latest add @audio-ui/knob`",
      "- Install the primitives: `npm install @audio-ui/react`",
      "- Every docs page is also served as markdown: replace `/docs` with `/llm` in its URL.",
      `- Created by [${siteConfig.author.name}](${siteConfig.author.url}). Source: ${siteConfig.links.github}`,
    ].join("\n"),
    // llms.txt allows no heading before the file lists: the guidance is plain text.
    [
      "When to use audio/ui:",
      "",
      "- A React app needs an audio control or display that works with a pointer, a keyboard and a screen reader: a knob, fader, XY pad, envelope, level meter, waveform, spectrum analyzer, tuner, drum pad or piano keyboard.",
      "- You are building the screens of a DAW, a synth, a mixer, a sampler or a player: an arrangement timeline, a piano roll, a step sequencer, a mixer, a transport bar, or the panel of an effect such as a compressor, an EQ or a reverb.",
      "- The sound comes from an engine of your own (Web Audio, an AudioWorklet, WASM): the workstation parts and the devices are controlled, values in and callbacks out, and need none of our audio hooks.",
      "- The app is in Vue, Svelte, Solid, Angular, web components or the plain DOM: `@audio-ui/core` has the same controllers without React.",
      "",
      "It is not made for React Native or other native apps, nor for audio processing that has no interface to show.",
    ].join("\n"),
    [
      "How an agent should use it:",
      "",
      "1. Pick the layer: the `@audio-ui` registry when the project has a `components.json` (shadcn/ui, Tailwind CSS v4), `@audio-ui/react` otherwise.",
      "2. Find the component: the pages below, the `search_docs` and `list_components` tools of the MCP server, or the same queries over the REST API (`/api/v1/search?q=` and `/api/v1/components`).",
      "3. Read its page as markdown before writing code: its API reference lists every part and prop.",
      "4. Install it with the command on that page. Registry components land in `components/audio-ui/`.",
    ].join("\n"),
    ["## Guides", ...guides.map(line)].join("\n"),
    ...spaces.map((space) =>
      [
        `## ${space.title}`,
        ...space.sections.flatMap((section) => section.pages.map(line)),
      ].join("\n")
    ),
    [
      "## For agents",
      `- [MCP server](${siteConfig.url}/mcp): remote Streamable HTTP server with the tools search_docs, list_components, get_component_docs and search_catalog.`,
      `- [Agent skills](${siteConfig.links.github}/tree/main/skills): install with \`npx skills add ouestlabs/audio-ui\`.`,
      `- [Full docs in one file](${siteConfig.url}/llms-full.txt)`,
      `- [REST API](${siteConfig.url}/api/v1): the components, their docs and the catalog as JSON, versioned, with no key. Docs: ${siteConfig.url}/llm/api`,
      `- [OpenAPI](${siteConfig.url}/openapi.json): the REST API, the registry and the MCP server, described.`,
      `- [API catalog](${siteConfig.url}/.well-known/api-catalog): the APIs as an RFC 9727 linkset.`,
      `- [Registry index](${siteConfig.url}/r/registry.json): every installable item, as JSON.`,
      "- [shadcn CLI](https://ui.shadcn.com/docs/cli): the command line that installs any item, `npx shadcn@latest add @audio-ui/<name>`.",
    ].join("\n"),
    [
      "## Optional",
      `- [Component catalog](${siteConfig.url}/components): ${getAllCatalogItems().length} ready blocks and demos.`,
      `- [Changelog feed](${siteConfig.url}/rss.xml)`,
      `- [About](${siteConfig.url}/about): who makes audio/ui, and its license.`,
      `- [Contact](${siteConfig.url}/contact): questions, bugs and security reports.`,
      `- [Privacy](${siteConfig.url}/privacy): what the site and the MCP server record.`,
    ].join("\n"),
  ];

  return `${body.join("\n\n")}\n`;
}
