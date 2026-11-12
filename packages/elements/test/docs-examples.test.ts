import { describe, expect, test } from "bun:test";
import { compile } from "svelte/compiler";
import { compileStyle, compileTemplate, parse } from "vue/compiler-sfc";

/** The docs' pages of the elements, where each one's usage is written in every framework and styling. */
const PAGES = `${import.meta.dir}/../../../apps/www/src/content/docs/elements`;
const FENCE = /```(vue|svelte)\n([\s\S]*?)```/g;

const pages = [...new Bun.Glob("*.mdx").scanSync(PAGES)].filter(
  (name) => name !== "index.mdx"
);

async function examples(page: string, language: "svelte" | "vue") {
  const text = await Bun.file(`${PAGES}/${page}`).text();
  return [...text.matchAll(FENCE)]
    .filter((match) => match[1] === language)
    .map((match) => match[2] ?? "");
}

/**
 * The examples are written for a reader to paste, so they have to compile:
 * with the Vue and Svelte compilers themselves, in both stylings.
 */
describe("the docs' examples", () => {
  test("there are examples to check", () => {
    expect(pages.length).toBeGreaterThanOrEqual(12);
  });

  test("the Vue ones compile: their template with the elements as custom elements, their styles", async () => {
    const problems: string[] = [];
    for (const page of pages) {
      for (const code of await examples(page, "vue")) {
        const { descriptor, errors } = parse(code, { filename: page });
        problems.push(...errors.map((error) => `${page}: ${error.message}`));
        if (descriptor.template) {
          const template = compileTemplate({
            compilerOptions: {
              isCustomElement: (tag) => tag.startsWith("audio-ui-"),
            },
            filename: page,
            id: page,
            source: descriptor.template.content,
          });
          problems.push(
            ...template.errors.map(
              (error) =>
                `${page}: ${typeof error === "string" ? error : error.message}`
            )
          );
        }
        for (const style of descriptor.styles) {
          const compiled = compileStyle({
            filename: page,
            id: page,
            scoped: false,
            source: style.content,
          });
          problems.push(
            ...compiled.errors.map((error) => `${page}: ${error.message}`)
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("the Svelte ones compile with no warning, their styles kept global", async () => {
    const problems: string[] = [];
    for (const page of pages) {
      for (const code of await examples(page, "svelte")) {
        const { warnings } = compile(code, {
          filename: `${page}.svelte`,
          generate: "client",
        });
        problems.push(...warnings.map((warning) => `${page}: ${warning.code}`));
      }
    }
    expect(problems).toEqual([]);
  });

  test("each page shows its examples in both stylings", async () => {
    const texts = await Promise.all(
      pages.map((page) => Bun.file(`${PAGES}/${page}`).text())
    );
    for (const text of texts) {
      expect(text).toContain('<ForStyling only="css">');
      expect(text).toContain('<ForStyling only="tailwind">');
    }
  });
});
