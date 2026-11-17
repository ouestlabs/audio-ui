import { expect, test } from "bun:test";

/**
 * The registry's items are files you own: none of them installs, declares or
 * imports a package of ours for the controls. What the libs, the hooks and the
 * blocks read of the primitives (sources, note names, the edits of a clip or
 * of notes, the geometry of an envelope, the levels of a meter) is a file the
 * registry ships, by an item of its own.
 */

const OUR_PACKAGE = /^@audio-ui\/(?:core|primitives)(?:\/|$)/;
const OUR_IMPORT = /from\s+"@audio-ui\/(?:core|primitives)(?:\/[^"]*)?"/;

interface BuiltItem {
  dependencies?: string[];
  files?: { content?: string; path?: string }[];
  name?: string;
}

const items: BuiltItem[] = await Promise.all(
  (
    await Array.fromAsync(
      new Bun.Glob("*.json").scan({
        absolute: true,
        cwd: `${import.meta.dir}/../public/r/styles/base-nova`,
      })
    )
  ).map((path) => Bun.file(path).json())
);

test("no item declares @audio-ui/core or @audio-ui/primitives as a dependency", () => {
  const declared = items
    .filter((item) =>
      (item.dependencies ?? []).some((name) => OUR_PACKAGE.test(name))
    )
    .map((item) => item.name);
  expect(declared).toEqual([]);
});

test("no file of an item imports @audio-ui/core or @audio-ui/primitives", () => {
  const importing = items.flatMap((item) =>
    (item.files ?? [])
      .filter((file) => OUR_IMPORT.test(file.content ?? ""))
      .map((file) => `${item.name}: ${file.path}`)
  );
  expect(importing).toEqual([]);
});
