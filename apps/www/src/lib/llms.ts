import { siteConfig } from "@/lib/config";
import { getGroupsFromFolder } from "@/lib/page-tree";
import { getAllCatalogItems } from "@/lib/registry";
import { source } from "@/lib/source";

function markdownUrl(url: string) {
  return `${siteConfig.url}${url.replace("/docs", "/llm")}`;
}

/** `/llms.txt`: the docs by space, for agents to start from. */
export function getLlmsTxt() {
  const pages = source.getPages();
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  // The pages by space (Elements, Workstation, Devices, Audio engine), as the sidebar groups them.
  const spaces = source
    .getPageTree()
    .children.flatMap((folder) =>
      folder.type === "folder"
        ? getGroupsFromFolder(folder, "base").filter(
            (group) => group.collapsible
          )
        : []
    );
  // A guide a space opens with, such as Devices, is listed in that space only.
  const inSpaces = new Set(
    spaces.flatMap((space) =>
      space.sections.flatMap((section) => section.pages.map((p) => p.url))
    )
  );
  const guides = pages.filter(
    (p) => !(p.slugs.join("/").startsWith("components") || inSpaces.has(p.url))
  );

  const line = (p: (typeof pages)[number]) =>
    `- [${p.data.title}](${markdownUrl(p.url)}): ${p.data.description}`;

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
    ["## Guides", ...guides.map(line)].join("\n"),
    ...spaces.map((space) =>
      [
        `## ${space.title}`,
        ...space.sections.flatMap((section) =>
          section.pages.flatMap((node) => {
            const page = byUrl.get(node.url);
            return page ? [line(page)] : [];
          })
        ),
      ].join("\n")
    ),
    [
      "## For agents",
      `- [MCP server](${siteConfig.url}/mcp): remote Streamable HTTP server with the tools list_components, get_component_docs and search_catalog.`,
      `- [Agent skill](${siteConfig.links.github}/tree/main/skills/audio-ui): install with \`npx skills add ouestlabs/audio-ui\`.`,
      `- [Full docs in one file](${siteConfig.url}/llms-full.txt)`,
    ].join("\n"),
    [
      "## Optional",
      `- [Component catalog](${siteConfig.url}/components): ${getAllCatalogItems().length} ready blocks and demos.`,
      `- [Changelog feed](${siteConfig.url}/rss.xml)`,
    ].join("\n"),
  ];

  return `${body.join("\n\n")}\n`;
}
