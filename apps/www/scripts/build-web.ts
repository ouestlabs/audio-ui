/**
 * Writes the web adapters of the primitives as files a plain HTML page runs,
 * with no bundler and no import map: `public/web/<name>.js`, one for each
 * primitive. They share their code in chunks beside them, so a page that loads
 * several downloads the common part once, and the packages they build on
 * (`@audio-ui/core`, `@audio-ui/primitives`, `@ui-sdk/web`) are inside.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PRIMITIVES = join(ROOT, "src/registry-audio/bases/base/primitives");
const OUT = join(ROOT, "public/web");
const ENTRIES = join(ROOT, "node_modules/.cache/web-entries");

const names = readdirSync(PRIMITIVES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => Bun.file(join(PRIMITIVES, name, "web/index.ts")).size > 0)
  .sort();

// An entry for each primitive named as its file will be: `knob.ts` writes `knob.js`.
rmSync(ENTRIES, { force: true, recursive: true });
mkdirSync(ENTRIES, { recursive: true });
for (const name of names) {
  writeFileSync(
    join(ENTRIES, `${name}.ts`),
    `import ${JSON.stringify(join(PRIMITIVES, name, "web/index.ts"))};\n`
  );
}

// A build writes the folder whole, so a primitive that is gone leaves no file behind.
rmSync(OUT, { force: true, recursive: true });

const result = await Bun.build({
  entrypoints: names.map((name) => join(ENTRIES, `${name}.ts`)),
  format: "esm",
  minify: true,
  naming: { chunk: "chunks/[hash].js", entry: "[name].js" },
  outdir: OUT,
  root: ENTRIES,
  splitting: true,
  target: "browser",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(
  `  web: ${names.length} primitives, ${result.outputs.length} files`
);
