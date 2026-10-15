import { expect, test } from "bun:test";

/**
 * A registry component installs to `components/audio-ui/<name>.tsx` and is
 * imported as `@/components/audio-ui/<name>`. These checks fail when an import
 * in the registry's own code, the docs or the shipped skill points at a file
 * the registry doesn't install, or when an icon is written in a way the shadcn
 * CLI can't turn into an import.
 */

const ROOT = `${import.meta.dir}/../../..`;
const AUDIO_UI_IMPORT = /@\/components\/audio-ui\/([a-z0-9-]+)/g;
// `import { A, B as C } from "@/components/audio-ui/<file>"`, possibly over several lines.
const NAMED_IMPORT =
  /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+"@\/components\/audio-ui\/([a-z0-9-]+)"/g;
const EXPORTED_DECLARATION =
  /^export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/gm;
const EXPORT_LIST = /^export\s+(?:type\s+)?\{([^}]+)\}/gm;
// An `@audio-ui/<name>` or `@shadcn/<name>` registry dependency.
const AUDIO_UI_DEPENDENCY = /^@audio-ui\/([a-z0-9-]+)$/;
const SHADCN_DEPENDENCY = /^@shadcn\/([a-z0-9-]+)$/;
// Every `from "@/…"` specifier in a built file.
const ALIAS_IMPORT = /from\s+"(@\/[^"]+)"/g;
const SHADCN_IMPORT = /^@\/components\/ui\/([a-z0-9-]+)$/;
// Where an alias import lands in the user's project.
const INSTALL_FOLDERS: Record<string, string> = {
  "@/components/audio-ui/": "components/audio-ui/",
  "@/components/examples/": "components/examples/",
  "@/hooks/": "hooks/",
  "@/lib/": "lib/",
};
// Not ours to install: the `cn` helper shadcn's init writes, and the icon
// import the shadcn CLI rewrites to the project's icon library.
const PROVIDED_BY_SHADCN = new Set([
  "@/app/(create)/components/icon-placeholder",
  "@/lib/utils",
]);
// The extension of an installed file.
const EXTENSION = /\.[a-z]+$/;
// `A as B` in an import or export list.
const ALIAS = /\s+as\s+/;
// The folder components were installed to before `audio-ui`.
const OLD_FOLDER = /components\/audio\/[a-z]/g;
// `lucide={playing ? "PauseIcon" : "PlayIcon"}` and its siblings: an expression
// where the CLI needs a string (`lucide={"Check"}` is fine).
const ICON_EXPRESSION =
  /\b(?:lucide|tabler|hugeicons|phosphor|remixicon)=\{(?!\s*["'`])/;

interface BuiltItem {
  files?: { content?: string; target?: string }[];
  name?: string;
  registryDependencies?: string[];
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
const installed = new Set(
  items.flatMap((item) => (item.files ?? []).map((file) => file.target ?? ""))
);

const byName = new Map(items.map((item) => [item.name ?? "", item]));

/**
 * An item and everything `shadcn add` installs with it: our items by name, and
 * the shadcn items they ask for as `shadcn:<name>`.
 */
function withDependencies(name: string, seen = new Set<string>()) {
  if (seen.has(name)) {
    return seen;
  }
  seen.add(name);
  for (const dependency of byName.get(name)?.registryDependencies ?? []) {
    const [, audioUi] = dependency.match(AUDIO_UI_DEPENDENCY) ?? [];
    const [, shadcn] = dependency.match(SHADCN_DEPENDENCY) ?? [];
    if (audioUi) {
      withDependencies(audioUi, seen);
    }
    if (shadcn) {
      seen.add(`shadcn:${shadcn}`);
    }
  }
  return seen;
}

const imports = (text: string) =>
  [...text.matchAll(AUDIO_UI_IMPORT)].map((match) => match[1] ?? "");
const missing = (names: string[]) =>
  [...new Set(names)].filter(
    (name) => !installed.has(`components/audio-ui/${name}.tsx`)
  );

async function readAll(pattern: string, cwd: string) {
  const paths = await Array.fromAsync(
    new Bun.Glob(pattern).scan({ absolute: true, cwd })
  );
  return (await Promise.all(paths.map((path) => Bun.file(path).text()))).join(
    "\n"
  );
}

test("registry code imports only components the registry installs", () => {
  const code = items
    .flatMap((item) => (item.files ?? []).map((file) => file.content ?? ""))
    .join("\n");
  expect(missing(imports(code))).toEqual([]);
});

test("the docs import only components the registry installs", async () => {
  const docs = await readAll("**/*.mdx", `${import.meta.dir}/../src/content`);
  expect(missing(imports(docs))).toEqual([]);
});

test("the skill imports only components the registry installs", async () => {
  const skill = await readAll("**/*.md", `${ROOT}/skills`);
  expect(missing(imports(skill))).toEqual([]);
});

test("nothing points at the old components/audio folder", async () => {
  const text = [
    await readAll("**/*.mdx", `${import.meta.dir}/../src/content`),
    await readAll("**/*.md", `${ROOT}/skills`),
    ...items.flatMap((item) =>
      (item.files ?? []).map((file) => `${file.target}\n${file.content}`)
    ),
  ].join("\n");
  expect(text.match(OLD_FOLDER) ?? []).toEqual([]);
});

/** Names a built file exports: declarations and `export { … }` lists. */
function exportsOf(content: string): Set<string> {
  const names = [...content.matchAll(EXPORTED_DECLARATION)].map(
    (match) => match[1] ?? ""
  );
  for (const [, list = ""] of content.matchAll(EXPORT_LIST)) {
    for (const part of list.split(",")) {
      const name = part.trim().split(ALIAS).pop()?.replace("type ", "");
      if (name) {
        names.push(name.trim());
      }
    }
  }
  return new Set(names);
}

test("named imports from @/components/audio-ui exist in the installed file", async () => {
  const contentByTarget = new Map(
    items.flatMap((item) =>
      (item.files ?? []).map(
        (file) => [file.target ?? "", file.content ?? ""] as const
      )
    )
  );
  const text = [
    await readAll("**/*.mdx", `${import.meta.dir}/../src/content`),
    await readAll("**/*.md", `${ROOT}/skills`),
  ].join("\n");
  const missingNames: string[] = [];
  for (const [, list = "", file] of text.matchAll(NAMED_IMPORT)) {
    const exported = exportsOf(
      contentByTarget.get(`components/audio-ui/${file}.tsx`) ?? ""
    );
    for (const part of list.split(",")) {
      const [name] = part.trim().replace("type ", "").split(ALIAS);
      if (name && !exported.has(name)) {
        missingNames.push(`${file}: ${name}`);
      }
    }
  }
  expect(missingNames).toEqual([]);
});

test("a component's docs page only imports what installing it brings", async () => {
  const pages = await Array.fromAsync(
    new Bun.Glob("*.mdx").scan({
      absolute: true,
      cwd: `${import.meta.dir}/../src/content/docs/components/base`,
    })
  );
  const unbrought = await Promise.all(
    pages.map(async (page) => {
      const component = page.split("/").pop()?.replace(".mdx", "") ?? "";
      // The page of a block is installed as `block-<name>`.
      const itemName = items.some((item) => item.name === component)
        ? component
        : `block-${component}`;
      const brought = withDependencies(itemName);
      return [...new Set(imports(await Bun.file(page).text()))]
        .filter((used) => !brought.has(used))
        .map((used) => `${component}: ${used}`);
    })
  );
  expect(unbrought.flat()).toEqual([]);
});

test("an item's own imports come with it when it is installed", () => {
  // Which item installs a path: `components/audio-ui/knob` -> "knob".
  const owner = new Map(
    items.flatMap((item) =>
      (item.files ?? []).map(
        (file) =>
          [(file.target ?? "").replace(EXTENSION, ""), item.name] as const
      )
    )
  );
  const problems: string[] = [];
  for (const item of items) {
    const brought = withDependencies(item.name ?? "");
    for (const file of item.files ?? []) {
      const specifiers = new Set(
        [...(file.content ?? "").matchAll(ALIAS_IMPORT)].map(
          (match) => match[1] ?? ""
        )
      );
      for (const specifier of specifiers) {
        if (PROVIDED_BY_SHADCN.has(specifier)) {
          continue;
        }
        const [, shadcn] = specifier.match(SHADCN_IMPORT) ?? [];
        if (shadcn) {
          if (!brought.has(`shadcn:${shadcn}`)) {
            problems.push(`${item.name}: ${specifier} (add @shadcn/${shadcn})`);
          }
          continue;
        }
        const folder = Object.keys(INSTALL_FOLDERS).find((prefix) =>
          specifier.startsWith(prefix)
        );
        const target = folder
          ? INSTALL_FOLDERS[folder] + specifier.slice(folder.length)
          : "";
        const needed = owner.get(target);
        if (!needed) {
          problems.push(`${item.name}: ${specifier} is installed by no item`);
        } else if (!brought.has(needed ?? "")) {
          problems.push(`${item.name}: ${specifier} (add @audio-ui/${needed})`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});

test("icons are string literals, so the shadcn CLI can turn them into imports", () => {
  // The CLI rewrites `<IconPlaceholder lucide="Check" />` into an import of
  // `Check`. Given an expression it writes `import { {playing ? … } }`.
  const expressions = items.flatMap((item) =>
    (item.files ?? [])
      .filter((file) => ICON_EXPRESSION.test(file.content ?? ""))
      .map((file) => `${item.name}: ${file.target}`)
  );
  expect(expressions).toEqual([]);
});
