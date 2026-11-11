/**
 * The manifest the docs' entry pages read: for each hook and lib of the
 * registry, where it installs, what it needs, what needs it, and what it
 * exports, each export with the first sentence of its JSDoc. Read from the
 * `_registry.ts` files and the sources, so an entry's header never says more
 * or less than what installs.
 *
 *   bun scripts/build-entries.ts          writes the manifest
 *   bun scripts/build-entries.ts --check  fails when it is stale
 */

import type { RegistryItem } from "shadcn/schema";

const WEB = `${import.meta.dir}/..`;
const BASE = `${WEB}/src/registry-audio/bases/base`;
export const MANIFEST = `${WEB}/src/lib/docs/content/entries.generated.json`;
const FOLDERS = ["audio", "devices", "hooks", "components", "lib"];

const EXPORT =
  /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?export (?:async )?(function|const|interface|type|class) (\w+)/g;
const JSDOC_LINE = /^\s*\*\s?/gm;
const JSDOC_EDGES = /^\/\*\*|\*\/$/g;
const FIRST_SENTENCE = /^(.+?\.)(?:\s|$)/;
const TAGS = /\s@\w[\s\S]*$/;
const WHITESPACE = /\s+/g;
const EXTENSION = /\.tsx?$/;

export interface EntryExport {
  kind: "class" | "const" | "function" | "interface" | "type";
  name: string;
  summary: string;
}

export interface Entry {
  dependencies: string[];
  description: string;
  exports: EntryExport[];
  files: string[];
  from: string;
  kind: "hook" | "lib";
  name: string;
  registryDependencies: string[];
  /** The files in the repository, from `apps/www/src/registry-audio/bases/base/`. */
  sources: string[];
  usedBy: string[];
}

/** The first sentence of a JSDoc block, on one line: what the export is. */
function summaryOf(jsdoc: string | undefined) {
  if (!jsdoc) {
    return "";
  }
  const text = jsdoc
    .trim()
    .replace(JSDOC_EDGES, "")
    .replace(JSDOC_LINE, "")
    .replace(WHITESPACE, " ")
    .replace(TAGS, "")
    .trim();
  return (FIRST_SENTENCE.exec(text)?.[1] ?? text).trim();
}

/** The exports a source file declares, in its order, each with what its JSDoc says first. */
export function exportsOf(source: string): EntryExport[] {
  return [...source.matchAll(EXPORT)].map((match) => ({
    kind: match[2] as EntryExport["kind"],
    name: match[3] ?? "",
    summary: summaryOf(match[1]),
  }));
}

/** Where a registry file installs in a project: an element to `components/audio-ui/`, a hook to `hooks/`, a lib to `lib/`. */
export function installedPath(path: string) {
  const file = path.split("/").at(-1) ?? path;
  if (path.startsWith("audio/")) {
    return `components/audio-ui/${file}`;
  }
  return `${path.split("/")[0]}/${file}`;
}

/** What a project imports an installed file as: `hooks/use-x.ts` is `@/hooks/use-x`. */
const importOf = (path: string) =>
  `@/${installedPath(path).replace(EXTENSION, "")}`;

async function loadItems(folders: readonly string[]): Promise<RegistryItem[]> {
  const loaded = await Promise.all(
    folders.map(async (folder) => {
      const module = (await import(`${BASE}/${folder}/_registry.ts`)) as Record<
        string,
        RegistryItem[] | undefined
      >;
      return module[folder] ?? [];
    })
  );
  return loaded.flat();
}

export async function buildEntries(): Promise<Entry[]> {
  const all = await loadItems(FOLDERS);
  const own = (await loadItems(["hooks", "lib"])).filter(
    (item) => (item.files?.length ?? 0) > 0
  );
  const entries = await Promise.all(
    own.map(async (item): Promise<Entry> => {
      const files = (item.files ?? []).map((file) => file.path);
      const main = await Bun.file(`${BASE}/${files[0]}`).text();
      return {
        dependencies: item.dependencies ?? [],
        description: item.description ?? "",
        exports: exportsOf(main),
        files: files.map(installedPath),
        from: importOf(files[0] ?? ""),
        kind: item.type === "registry:hook" ? "hook" : "lib",
        name: item.name,
        registryDependencies: (item.registryDependencies ?? []).map((dep) =>
          dep.replace("@audio-ui/", "")
        ),
        sources: files,
        usedBy: all
          .filter((other) =>
            other.registryDependencies?.includes(`@audio-ui/${item.name}`)
          )
          .map((other) => other.name)
          .sort(),
      };
    })
  );
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

// Normalized: the paths the resolver reaches have no `..` in them, so this prefix can be cut from them.
const PACKAGES = new URL("../../../packages", import.meta.url).pathname;
const CORE_SRC = `${PACKAGES}/core/src`;
export const CORE_MANIFEST = `${WEB}/src/lib/docs/content/core-modules.generated.json`;
const RE_EXPORT = /export (?:type )?\{([^}]*)\} from "(\.[^"]+)";/g;
const NAME_IN_BRACES = /^(?:type\s+)?(\w+)$/;

/** A module of `@audio-ui/core`, as its page heads it. */
export interface CoreModule {
  /** The adapters that draw it: `@audio-ui/react/knob`, `@audio-ui/elements/knob`. */
  adapters: string[];
  exports: EntryExport[];
  /** What a project imports it from. */
  from: string;
  /** Its subpath, `time`, or `core` for the package's root. */
  name: string;
  /** The files its exports are declared in, from `packages/core/src/`. */
  sources: string[];
  /** The registry's hooks and libs that import it: the ones with a page of their own. */
  usedBy: string[];
}

const read = (path: string) => Bun.file(path).text();
const resolvePath = (from: string, specifier: string) =>
  new URL(specifier, `file://${from}`).pathname;

/** Where `name`, exported by the file at `path`, is declared: followed through `export { … } from` until a file declares it. */
async function declarationOf(
  path: string,
  name: string
): Promise<{ declared: EntryExport; path: string }> {
  const source = await read(path);
  const declared = exportsOf(source).find((each) => each.name === name);
  if (declared) {
    return { declared, path };
  }
  for (const match of source.matchAll(RE_EXPORT)) {
    const names = (match[1] ?? "")
      .split(",")
      .map((each) => NAME_IN_BRACES.exec(each.trim())?.[1])
      .filter(Boolean);
    if (names.includes(name)) {
      return declarationOf(resolvePath(path, match[2] ?? ""), name);
    }
  }
  throw new Error(`${name} is exported by ${path} but declared nowhere`);
}

/** A module's exports in the order its entry file lists them, each from where it is declared. */
async function moduleExports(entry: string) {
  const source = await read(entry);
  const names = [...source.matchAll(RE_EXPORT)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((each) => NAME_IN_BRACES.exec(each.trim())?.[1] ?? "")
      .filter(Boolean)
  );
  return Promise.all(names.map((name) => declarationOf(entry, name)));
}

/** The files under `folder` that import `from`, as their paths. */
async function importers(folder: string, from: string) {
  const files = [...new Bun.Glob("**/*.{ts,tsx}").scanSync(folder)];
  const found = await Promise.all(
    files.map(async (file) =>
      (await read(`${folder}/${file}`)).includes(`from "${from}"`) ? file : ""
    )
  );
  return found.filter(Boolean);
}

/** The adapters of `@audio-ui/react` and `@audio-ui/elements` with a file that imports `from`. */
async function adaptersOf(from: string) {
  const roots = [
    { name: "@audio-ui/react", src: `${PACKAGES}/ui/src/primitives` },
    { name: "@audio-ui/elements", src: `${PACKAGES}/elements/src` },
  ];
  const found = await Promise.all(
    roots.map(async (root) => {
      const files = await importers(root.src, from);
      const primitives = new Set(
        files
          .filter((file) => file.includes("/") && !file.startsWith("internal/"))
          .map((file) => file.split("/")[0])
      );
      return [...primitives].sort().map((each) => `${root.name}/${each}`);
    })
  );
  return found.flat();
}

export async function buildCoreModules(): Promise<CoreModule[]> {
  const pkg = (await Bun.file(`${PACKAGES}/core/package.json`).json()) as {
    exports: Record<string, { types: string }>;
  };
  const items = await loadItems(["hooks", "lib"]);
  const itemFiles = await Promise.all(
    items.map(async (item) => ({
      name: item.name,
      sources: await Promise.all(
        (item.files ?? []).map((file) => read(`${BASE}/${file.path}`))
      ),
    }))
  );
  const subpaths = Object.entries(pkg.exports).filter(
    ([subpath]) => subpath !== "./internal"
  );
  return Promise.all(
    subpaths.map(async ([subpath, target]): Promise<CoreModule> => {
      const from =
        subpath === "."
          ? "@audio-ui/core"
          : `@audio-ui/core/${subpath.slice(2)}`;
      // The declaration file names the source: dist/audio/time/index.d.ts is src/audio/time/index.ts.
      const entry = `${CORE_SRC}/${target.types.replace("./dist/", "").replace(".d.ts", ".ts")}`;
      const resolved = await moduleExports(entry);
      return {
        adapters: await adaptersOf(from),
        exports: resolved.map((each) => each.declared),
        from,
        name: subpath === "." ? "core" : subpath.slice(2),
        sources: [
          ...new Set(
            resolved.map((each) => each.path.replace(`${CORE_SRC}/`, ""))
          ),
        ],
        usedBy: itemFiles
          .filter((item) =>
            item.sources.some((text) => text.includes(`from "${from}"`))
          )
          .map((item) => item.name)
          .sort(),
      };
    })
  );
}

const MANIFESTS = [
  { build: buildEntries, path: MANIFEST },
  { build: buildCoreModules, path: CORE_MANIFEST },
];

/** Writes a manifest, or with `check` says whether it is stale: `true` when it is up to date. */
async function writeManifest(
  manifest: (typeof MANIFESTS)[number],
  check: boolean
): Promise<boolean> {
  const text = `${JSON.stringify(await manifest.build(), null, 2)}\n`;
  const file = manifest.path.split("/").pop();
  if (check) {
    const current = await Bun.file(manifest.path)
      .text()
      .catch(() => "");
    if (current !== text) {
      console.error(`${file} is stale: run bun scripts/build-entries.ts`);
    }
    return current === text;
  }
  await Bun.write(manifest.path, text);
  console.log(`${file} written`);
  return true;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const fresh = await Promise.all(
    MANIFESTS.map((manifest) => writeManifest(manifest, check))
  );
  if (!fresh.every(Boolean)) {
    process.exit(1);
  }
}
