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
import { MODULE_SETS } from "../src/registry/bases/modules.ts";

const WEB = `${import.meta.dir}/..`;
const SHARED = `${WEB}/src/registry/bases/shared`;
const REGISTRY = `${WEB}/src/registry`;

/** A registry file by its path: `lib/` is at the registry root, the rest in `bases/shared/`. */
const sourceOf = (path: string) =>
  path.startsWith("lib/") ? `${REGISTRY}/${path}` : `${SHARED}/${path}`;
export const MANIFEST = `${WEB}/src/lib/docs/content/entries.generated.json`;
const FOLDERS = ["audio-ui", "devices", "hooks", "components", "lib"];

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
  if (path.startsWith("audio-ui/")) {
    return `components/audio-ui/${file}`;
  }
  return `${path.split("/")[0]}/${file}`;
}

/** What a project imports an installed file as: `hooks/use-x.ts` is `@/hooks/use-x`. */
const importOf = (path: string) =>
  `@/${installedPath(path).replace(EXTENSION, "")}`;

const DASH_LETTER = /-([a-z])/g;

async function loadItems(folders: readonly string[]): Promise<RegistryItem[]> {
  const loaded = await Promise.all(
    folders.map(async (folder) => {
      const module = (await import(
        `${folder === "lib" ? REGISTRY : SHARED}/${folder}/_registry.ts`
      )) as Record<string, RegistryItem[] | undefined>;
      return (
        module[
          folder.replace(DASH_LETTER, (_, letter: string) =>
            letter.toUpperCase()
          )
        ] ?? []
      );
    })
  );
  return loaded.flat();
}

export async function buildEntries(): Promise<Entry[]> {
  const all = await loadItems(FOLDERS);
  // A module of the engine or of webgl has its page in its own section, headed by its module.
  const own = (await loadItems(["hooks", "lib"])).filter(
    (item) =>
      (item.files?.length ?? 0) > 0 &&
      !(item.name.startsWith("engine-") || item.name.startsWith("webgl-"))
  );
  const entries = await Promise.all(
    own.map(async (item): Promise<Entry> => {
      const files = (item.files ?? []).map((file) => file.path);
      const main = await Bun.file(sourceOf(files[0] ?? "")).text();
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

export const MODULES_MANIFEST = `${WEB}/src/lib/docs/content/package-modules.generated.json`;
// `export { a, b as c } from "x"`, `export * as Name from "x"` and `export * from "x"`.
const EXPORT_FROM =
  /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?export\s+(?:type\s+)?(?:\{([^}]*)\}|\*\s+as\s+(\w+)|(\*))\s+from\s+"([^"]+)";/g;
// One name of an export list: `a`, `type a` or `a as b`.
const LISTED = /^(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?$/;
// `export default function name`, with its JSDoc, in a module or its declarations.
const DEFAULT_EXPORT =
  /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?export\s+default\s+(?:declare\s+)?(?:async\s+)?(function|class)?/;
// A module of the engine or of webgl, as the registry's files import it: `@/engine/time`.
const LIB_MODULE = /^@\/(engine|webgl)\/([a-z-]+)$/;
const SCRIPT_EXTENSION = /\.[cm]?js$/;
const SOURCE_FILE = /\.tsx?$/;

/** Where the modules of the engine and of webgl are, in the registry. */
const LIB = `${REGISTRY}/lib`;

/** A module of a published package, as its page heads it. */
export interface PackageModule {
  /** The audio.js packages it builds on, such as `@audio/note`: those its files import, and those whose code its kernels carry. */
  audiojs: string[];
  exports: EntryExport[];
  /** What a project imports it from, such as `@/lib/engine/time`: the module's key. */
  from: string;
  /** What a project installs: the module's registry item, `@audio-ui/engine-time`. */
  package: string;
  /** The registry's hooks and libs that import it: the ones with a page of their own. */
  usedBy: string[];
}

const read = (path: string) => Bun.file(path).text();

// An audio.js package a module's file imports, or a kernels file carries: `from "@audio/note"`, `import("@audio/encode")`, `` - `@audio/effect-lofi` ``.
const AUDIO_JS = /(?:from\s+"|import\("|^ \* - `)(@audio\/[a-z0-9-]+)/gm;

/** The audio.js packages a module builds on: those the files of its folder import, and those whose code its kernels carry. A module that is its package's root has none of its own. */
async function audioJsOf(entry: string): Promise<string[]> {
  const folder = entry.slice(0, entry.lastIndexOf("/"));
  if (folder.endsWith("/src")) {
    return [];
  }
  const files = [...new Bun.Glob("*.ts").scanSync(folder)].filter(
    (file) => !file.endsWith(".test.ts")
  );
  const texts = await Promise.all(
    files.map((file) => read(`${folder}/${file}`))
  );
  const found = texts.flatMap((text) =>
    [...text.matchAll(AUDIO_JS)].map((match) => match[1] ?? "")
  );
  return [...new Set(found)].sort();
}
const resolvePath = (from: string, specifier: string) =>
  new URL(specifier, `file://${from}`).pathname;

interface Resolved {
  declared: EntryExport;
  path: string;
}

/** The file a specifier names from the file at `from`: a relative path, a module of ours by its source, another package by its declarations, or nothing. */
async function fileOf(from: string, specifier: string): Promise<string | null> {
  if (specifier.startsWith(".")) {
    const path = resolvePath(from, specifier);
    // An import names a file with or without its extension, or a folder by its index.
    const candidates = [
      path,
      `${path}.ts`,
      `${path}.tsx`,
      `${path}/index.ts`,
    ].filter((file) => SOURCE_FILE.test(file));
    const found = await Promise.all(
      candidates.map((file) => Bun.file(file).exists())
    );
    return candidates[found.indexOf(true)] ?? null;
  }
  const module = LIB_MODULE.exec(specifier);
  if (module) {
    return `${LIB}/${module[1]}/${module[2]}/index.ts`;
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

export async function buildPackageModules(): Promise<PackageModule[]> {
  const items = await loadItems(["hooks", "lib"]);
  const itemFiles = await Promise.all(
    items.map(async (item) => ({
      name: item.name,
      sources: await Promise.all(
        (item.files ?? []).map((file) => read(sourceOf(file.path)))
      ),
    }))
  );
  // Registry items, installed to `lib/<set>/<module>`.
  return Promise.all(
    Object.entries(MODULE_SETS).flatMap(([set, modules]) =>
      Object.keys(modules).map(async (module): Promise<PackageModule> => {
        const entry = `${LIB}/${set}/${module}/index.ts`;
        const resolved = await moduleExports(entry);
        return {
          audiojs: await audioJsOf(entry),
          exports: resolved.map((each) => each.declared),
          from: `@/lib/${set}/${module}`,
          package: `@audio-ui/${set}-${module}`,
          usedBy: itemFiles
            .filter((item) =>
              item.sources.some((text) =>
                text.includes(`from "@/${set}/${module}"`)
              )
            )
            .map((item) => item.name)
            .sort(),
        };
      })
    )
  );
}

export const ITEM_FILES_MANIFEST = `${WEB}/src/lib/docs/content/item-files.generated.json`;

/**
 * Where each item's files land, as the built registry says (`~/` for the
 * project's root): what a docs page lists before it reads a file's code, so
 * the list is in its HTML.
 */
export async function buildItemFiles(): Promise<Record<string, string[]>> {
  const dir = `${WEB}/public/r/styles/base-nova`;
  const names = [...new Bun.Glob("*.json").scanSync(dir)].sort();
  const built = await Promise.all(
    names.map(
      (name) =>
        Bun.file(`${dir}/${name}`).json() as Promise<{
          files?: { path: string; target?: string }[];
          name?: string;
        }>
    )
  );
  const items: Record<string, string[]> = {};
  for (const item of built) {
    if (item.name && item.files && item.files.length > 0) {
      items[item.name] = item.files.map((file) => file.target ?? file.path);
    }
  }
  return items;
}

const MANIFESTS = [
  { build: buildEntries, path: MANIFEST },
  { build: buildPackageModules, path: MODULES_MANIFEST },
  { build: buildItemFiles, path: ITEM_FILES_MANIFEST },
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
