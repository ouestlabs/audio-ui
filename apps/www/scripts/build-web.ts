/**
 * Writes the web adapters of the primitives as files a plain HTML page runs,
 * with no bundler and no import map: `public/web/<version>/<name>.js`, one for
 * each primitive. They share their code in chunks beside them, so a page that
 * loads several downloads the common part once, and the packages they build on
 * (`@ui-sdk/web`) are inside.
 *
 * The folder is named by the version in `src/registry/web-version.json`,
 * and the files of a version are served as immutable: a build writes the
 * folder of the current version and never touches another, so a page pinned
 * to a version keeps what it was written against. An adapter that changes
 * ships under a new version: raise it there, and commit the folder this writes.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PRIMITIVES = join(ROOT, "src/registry/bases/shared/primitives");
const { version } = (await Bun.file(
  join(ROOT, "src/registry/web-version.json")
).json()) as { version: string };
const OUT = join(ROOT, "public/web", version);
const ENTRIES = join(ROOT, "node_modules/.cache/web-entries");
const DOCS = join(ROOT, "src/content/docs");
const SCRIPT_ORIGIN = "https://www.audio-ui.dev";
/** A script of any version, as a docs page writes its address. */
const SCRIPT_ADDRESS = /https:\/\/www\.audio-ui\.dev\/web\/\d+\.\d+\.\d+\//g;

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

// The folder of this version is written whole, so a primitive that is gone leaves no file behind.
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
  `  web ${version}: ${names.length} primitives, ${result.outputs.length} files`
);

// The docs show the scripts at the version just written: a page never names another, so raising the version is the one edit.
let pinned = 0;
for await (const path of new Bun.Glob("**/*.mdx").scan(DOCS)) {
  const page = Bun.file(join(DOCS, path));
  const text = await page.text();
  const next = text.replace(SCRIPT_ADDRESS, `${SCRIPT_ORIGIN}/web/${version}/`);
  if (next !== text) {
    await Bun.write(page, next);
    pinned += 1;
  }
}
if (pinned > 0) {
  console.log(`  web ${version}: pinned in ${pinned} docs page(s)`);
}
