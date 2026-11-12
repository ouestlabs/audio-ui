/**
 * Writes the usage of each React primitive in the two ways of styling it into
 * its page, under the live preview, between two markers, from
 * `src/lib/docs/content/react-usage.ts`.
 *
 *   bun scripts/react-usage.ts          check: lists the pages that differ, exits 1
 *   bun scripts/react-usage.ts --write  writes them
 */

import {
  REACT_USAGES,
  reactSnippets,
} from "../src/lib/docs/content/react-usage.ts";
import { STYLINGS } from "../src/lib/docs/content/stylings.ts";
import { withFallbacks } from "./element-usage.ts";

const PAGES = `${import.meta.dir}/../src/content/docs/react`;
const START =
  "{/* usage:start: written by `bun scripts/react-usage.ts --write` */}";
const END = "{/* usage:end */}";
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

/** The block a page holds, markers included. */
export function usageBlock(page: string): string | null {
  if (!REACT_USAGES[page]) {
    return null;
  }
  return [
    START,
    "",
    "The styles read the theme's CSS variables, which the [elements' overview](/docs/elements#styling) sets.",
    "",
    ...STYLINGS.flatMap(({ id }) => {
      const snippets = reactSnippets(page, id);
      return [
        `<ForStyling only="${id}">`,
        "",
        ...(snippets?.css
          ? [
              `\`\`\`css title="${page}.module.css"`,
              withFallbacks(snippets.css),
              "```",
              "",
            ]
          : []),
        `\`\`\`tsx title="${page}.tsx"`,
        snippets?.tsx ?? "",
        "```",
        "",
        "</ForStyling>",
        "",
      ];
    }),
    END,
  ].join("\n");
}

const HEADING = "## Usage\n\n";
const LEADING_BREAKS = /^\n+/;

/** A page's text with its preview at the top and its usage block, with its heading, right under the preview. */
export function withUsage(page: string, text: string): string {
  const block = usageBlock(page);
  if (!block) {
    return text;
  }
  // Wherever an earlier run put the block, it goes: it is written again under the preview.
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  let rest = text;
  if (start >= 0 && end > start) {
    const from = text.lastIndexOf(HEADING, start);
    const heading = from >= 0 && start - from === HEADING.length ? from : start;
    rest = `${text.slice(0, heading)}${text.slice(end + END.length).replace(LEADING_BREAKS, "")}`;
  }
  const preview = `<ReactPreview name="${page}" />\n`;
  const withPreview = rest.includes(preview)
    ? rest
    : rest.replace(FRONTMATTER, (head) => `${head}\n${preview}`);
  return withPreview.replace(
    preview,
    (found) => `${found}\n${HEADING}${block}\n\n`
  );
}

if (import.meta.main) {
  const write = process.argv.includes("--write");
  const pages = await Promise.all(
    Object.keys(REACT_USAGES).map(async (page) => {
      const path = `${PAGES}/${page}.mdx`;
      const text = await Bun.file(path).text();
      return { next: withUsage(page, text), page, path, text };
    })
  );
  const stale = pages.filter(({ next, text }) => next !== text);
  if (write) {
    await Promise.all(stale.map(({ next, path }) => Bun.write(path, next)));
  }
  if (stale.length > 0 && !write) {
    console.log(
      `Usage out of date: ${stale.map(({ page }) => page).join(", ")}. Run bun scripts/react-usage.ts --write`
    );
    process.exit(1);
  }
  console.log(
    write ? `Wrote ${stale.length} page(s)` : "Every page's usage is up to date"
  );
}
