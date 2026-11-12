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
const LEADING_BREAKS = /^\n+/;
const CLOSE = /^\n*<\/ReactPreview>/;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

/** The block a page holds, markers included. */
export function usageBlock(page: string): string | null {
  if (!REACT_USAGES[page]) {
    return null;
  }
  return [
    START,
    "",
    ...STYLINGS.flatMap(({ id }) => {
      const snippets = reactSnippets(page, id);
      return [
        `<ForStyling only="${id}">`,
        "",
        `<CodeFile title="${page}.tsx" open>`,
        "",
        "```tsx",
        snippets?.tsx ?? "",
        "```",
        "",
        "</CodeFile>",
        "",
        ...(snippets?.css
          ? [
              `<CodeFile title="${page}.module.css">`,
              "",
              "```css",
              withFallbacks(snippets.css),
              "```",
              "",
              "</CodeFile>",
              "",
            ]
          : []),
        "</ForStyling>",
        "",
      ];
    }),
    END,
  ].join("\n");
}

/** A page's text with its preview, and its usage block inside it as the code the preview shows. */
export function withUsage(page: string, text: string): string {
  const block = usageBlock(page);
  if (!block) {
    return text;
  }
  const open = `<ReactPreview name="${page}"`;
  let rest = text;
  const from = rest.indexOf(open);
  const end = rest.indexOf(END);
  if (from >= 0) {
    // Wherever an earlier run put the preview and its block, they go: both are written again.
    let to = end >= 0 ? end + END.length : rest.indexOf("\n", from) + 1;
    const close = rest.slice(to).match(CLOSE);
    to += close ? close[0].length : 0;
    rest = `${rest.slice(0, from)}${rest.slice(to).replace(LEADING_BREAKS, "")}`;
  }
  return rest.replace(
    FRONTMATTER,
    (head) => `${head}\n${open}>\n\n${block}\n\n</ReactPreview>\n\n`
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
