import { expect, test } from "bun:test";
import { SHARED_ITEMS } from "@/registry/bases/primitives";

/**
 * A shared file is installed under the same path by every primitive that
 * reads it, and the CLI skips a file a project already holds. A project keeps
 * the copy it installed first, so a later primitive must find in it everything
 * it reads: a shared file may gain exports, never lose one.
 *
 * `shared-exports.json` lists what each file exports. To record an addition,
 * run `UPDATE_SHARED_EXPORTS=1 bun test test/shared-files.test.ts`.
 */

const PRIMITIVES = `${import.meta.dir}/../src/registry/primitives`;
const BASELINE = `${import.meta.dir}/fixtures/shared-exports.json`;
const DECLARATION =
  /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:const|let|function\*?|async function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
const NAMED = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;
const ALIAS = /\s+as\s+/;
const TYPE_PREFIX = /^type\s+/;

const sharedFiles = [
  ...new Set(Object.values(SHARED_ITEMS).flatMap((item) => item.files)),
].sort();

function exportsOf(source: string) {
  const names = new Set<string>();
  for (const [, name] of source.matchAll(DECLARATION)) {
    names.add(name);
  }
  for (const [, list] of source.matchAll(NAMED)) {
    for (const entry of list.split(",")) {
      const name = entry.trim().split(ALIAS).pop()?.replace(TYPE_PREFIX, "");
      if (name) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

const current: Record<string, string[]> = Object.fromEntries(
  await Promise.all(
    sharedFiles.map(async (file) => [
      file,
      exportsOf(await Bun.file(`${PRIMITIVES}/${file}`).text()),
    ])
  )
);

if (process.env.UPDATE_SHARED_EXPORTS) {
  await Bun.write(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
}

const baseline: Record<string, string[]> = await Bun.file(BASELINE).json();

test("every shared file is in the baseline", () => {
  expect(Object.keys(baseline).sort()).toEqual(sharedFiles);
});

test("a shared file keeps every export it has shipped", () => {
  const lost = Object.entries(baseline).flatMap(([file, names]) =>
    names
      .filter((name) => !current[file]?.includes(name))
      .map((name) => `${file}: ${name}`)
  );
  expect(lost).toEqual([]);
});
