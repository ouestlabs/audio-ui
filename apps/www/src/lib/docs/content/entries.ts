import { siteConfig } from "@/lib/config";
import manifest from "@/lib/docs/content/entries.generated.json";
import packageModules from "@/lib/docs/content/package-modules.generated.json";

/** A hook or a lib as its entry page heads it: what `scripts/build-entries.ts` reads from the registry and the sources. */
export type Entry = (typeof manifest)[number];

const byName = new Map(manifest.map((entry) => [entry.name, entry]));

/** The entry of a hook or a lib by its install name; a name the registry does not have throws, so a page never heads one that is gone. */
export function entryOf(name: string): Entry {
  const entry = byName.get(name);
  if (!entry) {
    throw new Error(`No hook or lib "${name}" in the registry.`);
  }
  return entry;
}

/** The address of an item's entry page, or nothing for an item that has none (a component, a device, a block). */
export function entryUrl(name: string): string | undefined {
  const entry = byName.get(name);
  return entry
    ? `/docs/${entry.kind === "hook" ? "hooks" : "lib"}/${entry.name}`
    : undefined;
}

/** At most this many names in an entry's import line: the exports table lists the rest. */
const IMPORTED_NAMES = 5;

/** The line a project imports an entry's values with, the first few by their order in the file. */
export function importLine(entry: Pick<Entry, "exports" | "from">): string {
  // A custom element's entry registers its elements: importing it is what a page does.
  if (entry.from.startsWith("@audio-ui/elements")) {
    return `import "${entry.from}";`;
  }
  // A namespace's members, `Knob.Root`, come with one import of the namespace.
  const values = [
    ...new Set(
      entry.exports
        .filter((each) => each.kind !== "interface" && each.kind !== "type")
        .map((each) => each.name.split(".")[0] ?? each.name)
    ),
  ];
  const names =
    values.length > IMPORTED_NAMES
      ? [...values.slice(0, IMPORTED_NAMES), "/* … */"]
      : values;
  return `import { ${names.join(", ")} } from "${entry.from}";`;
}

/** Where an entry's file is in the repository. */
export const sourceUrl = (path: string) =>
  `${siteConfig.links.github}/blob/main/apps/www/src/registry-audio/bases/base/${path}`;

/** A module of a published package as its page heads it: what `scripts/build-entries.ts` reads from the package and its sources. */
export type PackageModule = (typeof packageModules)[number];

const moduleByImport = new Map(packageModules.map((each) => [each.from, each]));

/** A module by what a project imports it from, such as `@audio-ui/engine/time`; one the packages do not export throws. */
export function moduleOf(from: string): PackageModule {
  const found = moduleByImport.get(from);
  if (!found) {
    throw new Error(`No module "${from}" in the packages.`);
  }
  return found;
}

/** Where a file of a package is in the repository, from its root. */
export const repositoryUrl = (path: string) =>
  `${siteConfig.links.github}/blob/main/${path}`;

const ENTRY_TAG = /<Entry\s+name="([^"]+)"\s*\/>/g;
const MODULE_TAG = /<Module\s+from="([^"]+)"\s*\/>/g;

/** An entry's head as markdown, for an agent: the install, the import, what it needs and what needs it, and its exports. */
export function entryMarkdown(entry: Entry): string {
  const list = (names: readonly string[]) =>
    names.map((name) => `\`${name}\``).join(", ") || "nothing";
  return [
    "```bash",
    `npx shadcn@latest add @audio-ui/${entry.name}`,
    "```",
    "",
    "```ts",
    importLine(entry),
    "```",
    "",
    `- Files: ${list(entry.files)}`,
    `- Depends on: ${list(entry.registryDependencies)}; npm: ${list(entry.dependencies)}`,
    `- Used by: ${list(entry.usedBy)}`,
    `- Source: ${entry.sources.map(sourceUrl).join(", ")}`,
    "",
    ...exportsMarkdown(entry.exports),
  ].join("\n");
}

function exportsMarkdown(exports: Entry["exports"]) {
  return [
    "| Export | Kind | What it is |",
    "| --- | --- | --- |",
    ...exports.map(
      (each) => `| \`${each.name}\` | ${each.kind} | ${each.summary} |`
    ),
  ];
}

/** A module's head as markdown, for an agent: the install, the import, its adapters, what uses it and its exports. */
export function moduleMarkdown(packageModule: PackageModule): string {
  const list = (names: readonly string[]) =>
    names.map((name) => `\`${name}\``).join(", ") || "nothing";
  return [
    "```bash",
    `npm install ${packageModule.package}`,
    "```",
    "",
    "```ts",
    importLine(packageModule),
    "```",
    "",
    ...(packageModule.adapters.length > 0
      ? [`- Adapters: ${list(packageModule.adapters)}`]
      : []),
    ...(packageModule.usedBy.length > 0
      ? [`- Used by: ${list(packageModule.usedBy)}`]
      : []),
    `- Source: ${packageModule.sources.map(repositoryUrl).join(", ")}`,
    "",
    ...exportsMarkdown(packageModule.exports),
  ].join("\n");
}

/** Each `<Entry name="…" />` and `<Module from="…" />` of a page as its head in markdown. */
export function expandEntries(content: string) {
  return content
    .replace(ENTRY_TAG, (_tag, name: string) => entryMarkdown(entryOf(name)))
    .replace(MODULE_TAG, (_tag, from: string) =>
      moduleMarkdown(moduleOf(from))
    );
}
