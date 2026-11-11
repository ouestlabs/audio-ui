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
  /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?export (?:declare )?(?:async )?(function|const|interface|type|class) (\w+)/g;
const JSDOC_LINE = /^\s*\*\s?/gm;
const JSDOC_EDGES = /^\/\*\*|\*\/$/g;
const FIRST_SENTENCE = /^(.+?\.)(?:\s|$)/;
const TAGS = /\s@\w[\s\S]*$/;
const WHITESPACE = /\s+/g;
const EXTENSION = /\.tsx?$/;

export interface EntryExport {
  kind: "class" | "const" | "function" | "interface" | "namespace" | "type";
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
const REPOSITORY = new URL("../../..", import.meta.url).pathname;
export const MODULES_MANIFEST = `${WEB}/src/lib/docs/content/package-modules.generated.json`;
// `export { a, b as c } from "x"`, `export * as Name from "x"` and `export * from "x"`.
const EXPORT_FROM =
  /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?export\s+(?:type\s+)?(?:\{([^}]*)\}|\*\s+as\s+(\w+)|(\*))\s+from\s+"([^"]+)";/g;
// One name of an export list: `a`, `type a` or `a as b`.
const LISTED = /^(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?$/;
// `export default function name`, with its JSDoc, in a module or its declarations.
const DEFAULT_EXPORT =
  /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?export\s+default\s+(?:declare\s+)?(?:async\s+)?(function|class)?/;
const OUR_MODULE = /^@audio-ui\/(core|engine)(?:\/([a-z-]+))?$/;
const SCRIPT_EXTENSION = /\.[cm]?js$/;

/** The published packages whose modules have a page of their own: the folder of each under `packages/`. */
const MODULE_PACKAGES = [
  { folder: "core", name: "@audio-ui/core" },
  { folder: "engine", name: "@audio-ui/engine" },
  { folder: "elements", name: "@audio-ui/elements" },
  { folder: "ui", name: "@audio-ui/react" },
] as const;

/** A module of a published package, as its page heads it. */
export interface PackageModule {
  /** The adapters that draw it: `@audio-ui/react/knob`, `@audio-ui/elements/knob`. */
  adapters: string[];
  exports: EntryExport[];
  /** What a project imports it from, such as `@audio-ui/engine/time`: the module's key. */
  from: string;
  /** The package it is in, what a project installs. */
  package: string;
  /** The files its exports are declared in, from the repository's root. */
  sources: string[];
  /** The registry's hooks and libs that import it: the ones with a page of their own. */
  usedBy: string[];
}

const read = (path: string) => Bun.file(path).text();
const resolvePath = (from: string, specifier: string) =>
  new URL(specifier, `file://${from}`).pathname;

interface Resolved {
  declared: EntryExport;
  path: string;
}

/** The file a specifier names from the file at `from`: a relative path, a module of ours by its source, another package by its declarations, or nothing. */
async function fileOf(from: string, specifier: string): Promise<string | null> {
  if (specifier.startsWith(".")) {
    return resolvePath(from, specifier);
  }
  const ours = OUR_MODULE.exec(specifier);
  if (ours) {
    const [, pkg, sub] = ours;
    if (pkg === "engine") {
      return `${PACKAGES}/engine/src/${sub}/index.ts`;
    }
    if (!sub) {
      return `${PACKAGES}/core/src/index.ts`;
    }
    return sub === "internal"
      ? `${PACKAGES}/core/src/internal.ts`
      : `${PACKAGES}/core/src/primitives/${sub}/index.ts`;
  }
  try {
    const entry = Bun.resolveSync(
      specifier,
      from.slice(0, from.lastIndexOf("/"))
    );
    const types = entry.replace(SCRIPT_EXTENSION, ".d.ts");
    return (await Bun.file(types).exists()) ? types : null;
  } catch {
    return null;
  }
}

/** `name` as the file declares it itself, or nothing: its default export too. */
function ownDeclaration(
  source: string,
  path: string,
  name: string
): Resolved | null {
  const found = name === "default" ? DEFAULT_EXPORT.exec(source) : null;
  if (found) {
    const kind = found[2] === "class" ? "class" : "function";
    return { declared: { kind, name, summary: summaryOf(found[1]) }, path };
  }
  const own = exportsOf(source).find((each) => each.name === name);
  return own ? { declared: own, path } : null;
}

/** Where an `export … from` statement sends `name`: the name in the module it reads, or, for `* as name`, the namespace itself. */
function leadsOf(
  [, , list, namespace, star, specifier = ""]: RegExpMatchArray,
  name: string
): { imported: string; namespace: boolean; specifier: string }[] {
  if (namespace) {
    return namespace === name
      ? [{ imported: name, namespace: true, specifier }]
      : [];
  }
  if (star) {
    return [{ imported: name, namespace: false, specifier }];
  }
  return (list ?? "")
    .split(",")
    .map((item) => LISTED.exec(item.trim()))
    .filter(
      (match): match is RegExpExecArray =>
        match !== null && (match[2] ?? match[1]) === name
    )
    .map((match) => ({
      imported: match[1] ?? name,
      namespace: false,
      specifier,
    }));
}

/** Where `name`, exported by the file at `path`, is declared: followed through every kind of re-export until a file declares it. */
async function declarationOf(
  path: string,
  name: string,
  seen = new Set<string>()
): Promise<Resolved | null> {
  const key = `${path}#${name}`;
  if (seen.has(key)) {
    return null;
  }
  seen.add(key);
  const source = await read(path).catch(() => "");
  const own = ownDeclaration(source, path, name);
  if (own) {
    return own;
  }
  const leads = [...source.matchAll(EXPORT_FROM)].flatMap((match) =>
    leadsOf(match, name)
  );
  const found = await Promise.all(
    leads.map(async (lead): Promise<Resolved | null> => {
      if (lead.namespace) {
        const summary = `The ${name} primitive's parts, \`${name}.Root\` and the rest.`;
        return { declared: { kind: "namespace", name, summary }, path };
      }
      const target = await fileOf(path, lead.specifier);
      return target ? declarationOf(target, lead.imported, seen) : null;
    })
  );
  // The first statement that leads to a declaration is the one that exports it.
  return found.find((each) => each !== null) ?? null;
}

/** What one `export … from` statement of `entry` exports, each from where it is declared. */
async function statementExports(
  entry: string,
  [, doc, list, namespace, star, specifier = ""]: RegExpMatchArray
): Promise<Resolved[]> {
  const target = await fileOf(entry, specifier);
  if (!target) {
    throw new Error(
      `${entry} re-exports ${specifier}, which resolves to nothing`
    );
  }
  if (namespace) {
    return (await moduleExports(target)).map((member) => ({
      declared: {
        ...member.declared,
        name: `${namespace}.${member.declared.name}`,
      },
      path: member.path,
    }));
  }
  if (star) {
    return moduleExports(target);
  }
  const listed = (list ?? "")
    .split(",")
    .map((item) => LISTED.exec(item.trim()))
    .filter((match) => match !== null);
  return Promise.all(
    listed.map(async ([, imported = "", exported = imported]) => {
      const found = await declarationOf(target, imported);
      if (!found) {
        throw new Error(
          `${exported} is exported by ${entry} but declared nowhere`
        );
      }
      // A re-export documented where it is made speaks for a declaration that is not.
      const summary = found.declared.summary || summaryOf(doc);
      return {
        declared: { ...found.declared, name: exported, summary },
        path: found.path,
      };
    })
  );
}

/** A module's exports in the order its file lists them, each from where it is declared, a namespace's members as `Name.member`. */
async function moduleExports(entry: string): Promise<Resolved[]> {
  const source = await read(entry);
  const own = exportsOf(source).map((declared) => ({ declared, path: entry }));
  const statements = await Promise.all(
    [...source.matchAll(EXPORT_FROM)].map((match) =>
      statementExports(entry, match)
    )
  );
  return [...own, ...statements.flat()];
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

export async function buildPackageModules(): Promise<PackageModule[]> {
  const items = await loadItems(["hooks", "lib"]);
  const itemFiles = await Promise.all(
    items.map(async (item) => ({
      name: item.name,
      sources: await Promise.all(
        (item.files ?? []).map((file) => read(`${BASE}/${file.path}`))
      ),
    }))
  );
  const modules = await Promise.all(
    MODULE_PACKAGES.map(async ({ folder, name }) => {
      const pkg = (await Bun.file(
        `${PACKAGES}/${folder}/package.json`
      ).json()) as { exports: Record<string, { types: string }> };
      const subpaths = Object.entries(pkg.exports).filter(
        ([subpath]) => subpath !== "./internal"
      );
      return Promise.all(
        subpaths.map(async ([subpath, target]): Promise<PackageModule> => {
          const from = subpath === "." ? name : `${name}/${subpath.slice(2)}`;
          // The declaration file names the source: dist/time/index.d.ts is src/time/index.ts.
          const entry = `${PACKAGES}/${folder}/src/${target.types.replace("./dist/", "").replace(".d.ts", ".ts")}`;
          const resolved = await moduleExports(entry);
          return {
            adapters: await adaptersOf(from),
            exports: resolved.map((each) => each.declared),
            from,
            package: name,
            sources: [
              ...new Set(
                resolved
                  .filter((each) => each.path.startsWith(PACKAGES))
                  .map((each) => each.path.replace(REPOSITORY, ""))
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
    })
  );
  return modules.flat();
}

const MANIFESTS = [
  { build: buildEntries, path: MANIFEST },
  { build: buildPackageModules, path: MODULES_MANIFEST },
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
