import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const PRIMITIVES = join(import.meta.dir, "../src/registry/primitives");
const { version } = (await Bun.file(
  join(import.meta.dir, "../src/registry/web-version.json")
).json()) as { version: string };
const WEB = join(import.meta.dir, "../public/web", version);

// The static imports a bundle opens with: `import{a,b}from"./chunk.js"`.
const STATIC_IMPORT = /(?:^|;)import\s*(?:\{[^}]*\})?\s*from\s*"([^"]+)"/g;
const CORS_HEADER = /\/web\/\*[\s\S]*Access-Control-Allow-Origin: \*/;

const primitives = readdirSync(PRIMITIVES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

test("every primitive has its web adapter as a script a page runs, built by registry:build", async () => {
  const present = await Promise.all(
    primitives.map(async (name) => {
      const file = Bun.file(join(WEB, `${name}.js`));
      return { exists: await file.exists(), name, size: file.size };
    })
  );
  for (const { exists, name, size } of present) {
    expect(exists, `${name}.js is missing: run registry:build`).toBe(true);
    expect(size).toBeGreaterThan(0);
  }
});

test("a web script imports its chunks by relative path, and no package by name", async () => {
  const bundles = await Promise.all(
    primitives.map(async (name) => ({
      code: await Bun.file(join(WEB, `${name}.js`)).text(),
      name,
    }))
  );
  for (const { code, name } of bundles) {
    const imports = [...code.matchAll(STATIC_IMPORT)].map(
      (match) => match[1] ?? ""
    );
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
  expect(headers).toMatch(CORS_HEADER);
});
