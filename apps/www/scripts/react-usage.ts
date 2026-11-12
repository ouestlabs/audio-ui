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
const MODULE = /<Module from="[^"]+" \/>\n/;

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

/** A page's text with its preview at the top and its usage block written under the head. */
export function withUsage(page: string, text: string): string {
  const block = usageBlock(page);
  if (!block) {
    return text;
  }
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start >= 0 && end > start) {
    return `${text.slice(0, start)}${block}${text.slice(end + END.length)}`;
  }
  const preview = `<ReactPreview name="${page}" />\n`;
  const withPreview = text.includes(preview)
    ? text
    : text.replace(FRONTMATTER, (head) => `${head}\n${preview}`);
  return withPreview.replace(
    MODULE,
    (found) => `${found}\n## Usage\n\n${block}\n`
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
