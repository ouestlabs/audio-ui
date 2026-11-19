import { expect, test } from "bun:test";
import { MODULE_SETS } from "@/registry/bases/modules";

/**
 * The items of the engine and of webgl list each module's files, the npm packages
 * they import and the other modules they reach: the folders decide, so a file
 * added, removed or importing something new shows here first.
 */

const LIB = `${import.meta.dir}/../src/registry/lib`;
// A static import or export, and a dynamic `import("…")`.
const SPECIFIER = /(?:from\s+"|import\(\s*")([^"]+)"/g;
const NOT_SHIPPED = /\.(?:test|bench)\.ts$/;
const SCOPED = /^@[^/]+\/[^/]+/;
const BARE = /^[^/]+/;

const cases = Object.entries(MODULE_SETS).flatMap(([set, listed]) => {
  const folder = `${LIB}/${set}`;
  const modules = [...new Bun.Glob("*/index.ts").scanSync({ cwd: folder })].map(
    (path) => path.split("/")[0] ?? ""
  );
  return [{ folder, listed, modules, set }];
});

test.each(cases)(
  "every module of $set has its item, and only those",
  ({ listed, modules }) => {
    expect(Object.keys(listed).toSorted()).toEqual(modules.toSorted());
  }
);

const each = cases.flatMap(({ folder, listed, modules, set }) =>
  modules.map((module) => ({
    folder,
    listed,
    module,
    name: `${set}-${module}`,
  }))
);

test.each(each)(
  "$name lists its files, packages and modules",
  async ({ folder, listed, module }) => {
    const files = [
      ...new Bun.Glob("**/*.ts").scanSync({ cwd: `${folder}/${module}` }),
    ]
      .filter((file) => !NOT_SHIPPED.test(file))
      .toSorted();
    const packages = new Set<string>();
    const reached = new Set<string>();
    const texts = await Promise.all(
      files.map((file) => Bun.file(`${folder}/${module}/${file}`).text())
    );
    for (const [index, file] of files.entries()) {
      const text = texts[index] ?? "";
      for (const [, specifier = ""] of text.matchAll(SPECIFIER)) {
        if (specifier.startsWith(".")) {
          const parts = new URL(specifier, `file:///${module}/${file}`).pathname
            .split("/")
            .filter(Boolean);
          if (parts[0] && parts[0] !== module) {
            reached.add(parts[0]);
          }
        } else {
          packages.add(
            (SCOPED.exec(specifier) ?? BARE.exec(specifier))?.[0] ?? specifier
          );
        }
      }
    }
    const spec = listed[module];
    expect(spec?.files).toEqual(files);
    expect(spec?.dependencies).toEqual([...packages].toSorted());
    expect(spec?.modules).toEqual([...reached].toSorted());
  }
);
