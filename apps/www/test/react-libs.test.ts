import { expect, test } from "bun:test";
import { REACT_LIBS } from "@/lib/docs/content/framework-paths";

/**
 * A library is shown to every framework unless it needs React: it imports
 * `react` or a hook, holds a `.tsx` file, or installs an item that does. The
 * built registry decides, so a library that comes to need React shows here.
 */

const BUILT = `${import.meta.dir}/../public/r/styles/base-nova`;
const DOCS = `${import.meta.dir}/../src/content/docs/lib`;
const REACT_IMPORT = /from "(?:react(?:-dom)?(?:\/[^"]*)?|@\/hooks\/[^"]*)"/;
const TSX = /\.tsx$/;
const NAMESPACE = "@audio-ui/";

interface BuiltItem {
  files?: { content?: string; path?: string }[];
  name: string;
  registryDependencies?: string[];
}

const items = new Map<string, BuiltItem>(
  (
    await Promise.all(
      [...new Bun.Glob("*.json").scanSync({ absolute: true, cwd: BUILT })].map(
        (path) => Bun.file(path).json() as Promise<BuiltItem>
      )
    )
  ).map((item) => [item.name, item])
);

function needsReact(name: string, seen = new Set<string>()): boolean {
  const item = items.get(name);
  if (!item || seen.has(name)) {
    return false;
  }
  seen.add(name);
  const own = (item.files ?? []).some(
    (file) => TSX.test(file.path ?? "") || REACT_IMPORT.test(file.content ?? "")
  );
  return (
    own ||
    (item.registryDependencies ?? [])
      .filter((dependency) => dependency.startsWith(NAMESPACE))
      .some((dependency) =>
        needsReact(dependency.slice(NAMESPACE.length), seen)
      )
  );
}

test("the libraries shown to React alone are those that need React", () => {
  const documented = [...new Bun.Glob("*.mdx").scanSync({ cwd: DOCS })].map(
    (file) => file.replace(".mdx", "")
  );
  expect(documented.filter((name) => needsReact(name)).toSorted()).toEqual(
    REACT_LIBS.toSorted()
  );
});
