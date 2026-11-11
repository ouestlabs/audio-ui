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

if (import.meta.main) {
  const text = `${JSON.stringify(await buildEntries(), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = await Bun.file(MANIFEST)
      .text()
      .catch(() => "");
    if (current !== text) {
      console.error(
        "entries.generated.json is stale: run bun scripts/build-entries.ts"
      );
      process.exit(1);
    }
  } else {
    await Bun.write(MANIFEST, text);
    console.log(`${MANIFEST.split("/").pop()} written`);
  }
}
