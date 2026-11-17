import { expect, test } from "bun:test";
import { ENGINE_MODULES } from "@/registry-audio/bases/engine";

/**
 * The engine's items list each module's files, the npm packages they import
 * and the other modules they reach: the folder decides, so a file added,
 * removed or importing something new shows here first.
 */

const ENGINE = `${import.meta.dir}/../src/registry-audio/bases/base/lib/engine`;
// A static import or export, and a dynamic `import("…")`.
const SPECIFIER = /(?:from\s+"|import\(\s*")([^"]+)"/g;
const NOT_SHIPPED = /\.(?:test|bench)\.ts$/;
const SCOPED = /^@[^/]+\/[^/]+/;
const BARE = /^[^/]+/;

const modules = [...new Bun.Glob("*/index.ts").scanSync({ cwd: ENGINE })].map(
  (path) => path.split("/")[0] ?? ""
);

test("every module of the engine has its item, and only those", () => {
  expect(Object.keys(ENGINE_MODULES).toSorted()).toEqual(modules.toSorted());
});

test.each(modules)(
  "engine-%s lists its files, packages and modules",
  async (module) => {
    const files = [
      ...new Bun.Glob("**/*.ts").scanSync({ cwd: `${ENGINE}/${module}` }),
    ]
      .filter((file) => !NOT_SHIPPED.test(file))
      .toSorted();
    const packages = new Set<string>();
    const reached = new Set<string>();
    for (const file of files) {
      const text = await Bun.file(`${ENGINE}/${module}/${file}`).text();
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
    const spec = ENGINE_MODULES[module];
    expect(spec?.files).toEqual(files);
    expect(spec?.dependencies).toEqual([...packages].toSorted());
    expect(spec?.modules).toEqual([...reached].toSorted());
  }
);
