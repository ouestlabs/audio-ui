import { describe, expect, test } from "bun:test";

const CODE_BLOCK = /```(?:ts|tsx)\n([\s\S]*?)```/g;
const CORE_IMPORT =
  /import\s*\{([^}]*)\}\s*from\s*"(@audio-ui\/core\/[a-z-]+)"/g;
const TYPE_NAME = /^[A-Z]/;
const TYPE_MODIFIER = /^type\s+/;

/** The TypeScript and TSX code blocks of a Markdown document. */
function snippetsOf(markdown: string): string[] {
  return [...markdown.matchAll(CODE_BLOCK)].map((match) => match[1] ?? "");
}

/** The named imports of a snippet from `@audio-ui/core/*`, with their modules. Types are left out: they have no runtime export. */
function valueImportsOf(snippet: string) {
  return [...snippet.matchAll(CORE_IMPORT)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((name) => name.trim().replace(TYPE_MODIFIER, ""))
      .filter((name) => name && !TYPE_NAME.test(name))
      .map((name) => ({ module: match[2] ?? "", name }))
  );
}

const DOCS = [
  "../../../skills/audio-ui/core.md",
  "../src/content/docs/engine/controllers.mdx",
];

describe("documentation snippets", () => {
  for (const path of DOCS) {
    test(`${path}: every code block parses as TypeScript`, async () => {
      const transpiler = new Bun.Transpiler({ loader: "tsx" });
      const source = await Bun.file(new URL(path, import.meta.url)).text();
      for (const snippet of snippetsOf(source)) {
        expect(() => transpiler.transformSync(snippet)).not.toThrow();
      }
    });

    test(`${path}: every @audio-ui/core value it imports exists`, async () => {
      const source = await Bun.file(new URL(path, import.meta.url)).text();
      const imports = snippetsOf(source).flatMap(valueImportsOf);
      const modules = await Promise.all(
        imports.map(({ module }) => import(module))
      );
      imports.forEach(({ module, name }, index) => {
        expect(
          Object.hasOwn(modules[index] ?? {}, name),
          `${name} is not exported by ${module}`
        ).toBe(true);
      });
    });
  }
});
