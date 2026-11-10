import { describe, expect, test } from "bun:test";
import { Glob } from "bun";

const DOCS = `${import.meta.dir}/../src/content/docs`;
const FENCE = /^\s*```/;
const INLINE_CODE = /`[^`]*`/g;
const COMMENT = /\{\/\*.*?\*\/\}/g;
const QUOTED_ATTRIBUTE = /[=]\s*"[^"]*"/g;
const EXPRESSION_ATTRIBUTE = /[=]\{(?:"(?:[^"\\]|\\.)*"|[^}]*)\}/g;
/** A bare `{name}` in text, which MDX evaluates as JavaScript: a placeholder such as `{n}` throws when the page renders. */
const BARE_EXPRESSION = /\{[A-Za-z_$][\w$]*\}/;

/** The lines of `text` that hold a bare expression outside code, by number from 1. */
function bareExpressionLines(text: string): number[] {
  const lines: number[] = [];
  let fenced = false;
  for (const [index, line] of text.split("\n").entries()) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    const prose = line
      .replace(INLINE_CODE, "")
      .replace(COMMENT, "")
      .replace(QUOTED_ATTRIBUTE, "")
      .replace(EXPRESSION_ATTRIBUTE, "");
    if (!fenced && BARE_EXPRESSION.test(prose)) {
      lines.push(index + 1);
    }
  }
  return lines;
}

describe("docs MDX", () => {
  test("no page writes a bare {name} in its text, where MDX would evaluate it", async () => {
    const files = await Array.fromAsync(new Glob("**/*.mdx").scan(DOCS));
    const texts = await Promise.all(
      files.map((file) => Bun.file(`${DOCS}/${file}`).text())
    );
    const found = files.flatMap((file, index) =>
      bareExpressionLines(texts[index] ?? "").map((line) => `${file}:${line}`)
    );
    expect(found).toEqual([]);
  });

  test("the check catches a placeholder in a table cell, and lets code and attributes through", () => {
    expect(
      bareExpressionLines(
        [
          '| `label` | Names them ("Point {n}") |',
          "| `label` | Names them (`Point {n}`) |",
          '<TypeRow name="GET /api/{name}" type={"string"}>{/* note */}</TypeRow>',
          "```html",
          "<p>{n}</p>",
          "```",
        ].join("\n")
      )
    ).toEqual([1]);
  });
});
