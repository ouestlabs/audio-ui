/**
 * Writes the usage of each React primitive in the two ways of styling it into
 * its page, under the live preview, between two markers, from
 * `src/lib/docs/content/react-usage.ts`.
 *
 *   bun scripts/react-usage.ts          check: lists the pages that differ, exits 1
 *   bun scripts/react-usage.ts --write  writes them
 */

import { EXAMPLES } from "../src/lib/docs/content/primitive-examples.ts";
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

const EXAMPLES_START =
  "{/* examples:start: written by `bun scripts/react-usage.ts --write` */}";
const EXAMPLES_END = "{/* examples:end */}";
const API = "## API reference";

/** One example's code in each styling, as the usage block writes it. */
function exampleBlock(page: string, id: string) {
  const example = EXAMPLES[page]?.find((each) => each.id === id);
  return [
    ...STYLINGS.flatMap(({ id: styling }) => {
      const snippets = reactSnippets(page, styling, example);
      return [
        `<ForStyling only="${styling}">`,
        "",
        `<CodeFile title="${page}.tsx" open>`,
        "",
        "```tsx",
        snippets?.tsx ?? "",
        "```",
        "",
        "</CodeFile>",
        "",
        "</ForStyling>",
        "",
      ];
    }),
  ].join("\n");
}

/** The Examples of a page: a section between its Anatomy and its API reference, a preview and its code each. */
export function examplesBlock(page: string): string | null {
  const examples = EXAMPLES[page];
  if (!(examples && REACT_USAGES[page])) {
    return null;
  }
  return [
    EXAMPLES_START,
    "",
    "## Examples",
    "",
    ...examples.flatMap((example) => [
      `### ${example.title}`,
      "",
      example.description,
      "",
      `<ReactPreview name="${page}" example="${example.id}">`,
      "",
      exampleBlock(page, example.id),
      "</ReactPreview>",
      "",
    ]),
    EXAMPLES_END,
  ].join("\n");
}

/** A page's text with its examples written between their markers, or put before its API reference. */
export function withExamples(page: string, text: string): string {
  const block = examplesBlock(page);
  if (!block) {
    return text;
  }
  const start = text.indexOf(EXAMPLES_START);
  const end = text.indexOf(EXAMPLES_END);
  if (start >= 0 && end > start) {
    return `${text.slice(0, start)}${block}${text.slice(end + EXAMPLES_END.length)}`;
  }
  return text.replace(API, `${block}\n\n${API}`);
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
      return {
        next: withExamples(page, withUsage(page, text)),
        page,
        path,
        text,
      };
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
