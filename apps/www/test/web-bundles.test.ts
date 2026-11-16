import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const PRIMITIVES = join(
  import.meta.dir,
  "../src/registry-audio/bases/base/primitives"
);
const { version } = (await Bun.file(
  join(import.meta.dir, "../../../packages/primitives/package.json")
).json()) as { version: string };
const WEB = join(import.meta.dir, "../public/web", version);

const primitives = readdirSync(PRIMITIVES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

test("every primitive has its web adapter as a script a page runs, built by registry:build", async () => {
  for (const name of primitives) {
    const file = Bun.file(join(WEB, `${name}.js`));
    expect(
      await file.exists(),
      `${name}.js is missing: run registry:build`
    ).toBe(true);
    expect(file.size).toBeGreaterThan(0);
  }
});

test("a web script imports its chunks by relative path, and no package by name", async () => {
  for (const name of primitives) {
    const code = await Bun.file(join(WEB, `${name}.js`)).text();
    // The static imports the bundle opens with: `import{a,b}from"./chunk.js"`.
    const imports = [
      ...code.matchAll(/(?:^|;)import\s*(?:\{[^}]*\})?\s*from\s*"([^"]+)"/g),
    ].map((match) => match[1] ?? "");
    expect(imports.length, `${name}.js has no import to check`).toBeGreaterThan(
      0
    );
    for (const specifier of imports) {
      expect(
        specifier.startsWith("./"),
        `${name}.js imports ${specifier}`
      ).toBe(true);
    }
  }
});

test("the installation page pins the version of the scripts it shows", async () => {
  const page = await Bun.file(
    join(import.meta.dir, "../src/content/docs/(root)/installation.mdx")
  ).text();
  expect(page).toContain(`https://www.audio-ui.dev/web/${version}/knob.js`);
});

test("the files of /web/ may be loaded by any page", async () => {
  const headers = await Bun.file(
    join(import.meta.dir, "../public/_headers")
  ).text();
  expect(headers).toMatch(/\/web\/\*[\s\S]*Access-Control-Allow-Origin: \*/);
});
