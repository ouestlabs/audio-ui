/**
 * Build Static Registry
 *
 * Pre-compiles every registry item (the audio components, hooks and lib items,
 * and the catalog blocks and demos under `registry-audio/bases/{base}`) into
 * static JSON in `public/r/styles/`, so the registry is served from the CDN
 * edge with no serverless function in between.
 *
 * Output:
 *   public/r/styles/index.json             the styles on offer
 *   public/r/styles/{style}/{name}.json    one file per item per style
 *   public/r/styles/{style}/registry.json  the style's items, without file contents
 *
 * The `default` style is not written: next.config.ts redirects it to base-nova.
 *
 * Run: bun run registry:build
 */

import { $ } from "bun";
import { isCatalogItemName } from "../src/lib/catalog-name.ts";
import { transformStyleClassNames } from "../src/lib/code-utils.ts";
import { BASES as ALL_BASES } from "../src/registry/bases.ts";
import { categories, rootSeo } from "../src/registry-audio/bases/categories.ts";

// ---------------------------------------------------------------------------
// Where things are
// ---------------------------------------------------------------------------

const PROJECT_ROOT = `${import.meta.dir}/..`;
const REGISTRY_AUDIO = `${PROJECT_ROOT}/src/registry-audio`;
const BASES_DIR = `${REGISTRY_AUDIO}/bases`;
const OUTPUT_ROOT = `${PROJECT_ROOT}/public/r/styles`;

const NAMESPACE = "@audio-ui";
const HOMEPAGE = "https://www.audio-ui.dev";
const DEFAULT_STYLE = "base-nova";

// Only the `base` base ships audio items, and its catalog drives the manifests.
const BASES = ALL_BASES.filter((base) => base.name === "base");
const MANIFEST_BASE = "base";

// Style names only: `registry/styles.tsx` also holds inline JSX icon SVGs that
// can't be evaluated here, and the set is `registry/styles/style-*.css`.
const STYLES = ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"];

// The folders of a base that hold registry items. Each `_registry.ts` exports
// an array named after its folder; a later folder wins on a repeated name.
const REGISTRY_FOLDERS = ["audio", "hooks", "components", "lib"];

// A folder a registry file imports from, and where it lands in a project.
const INSTALL_FOLDERS: [folder: string, installed: string][] = [
  ["audio/(?:elements/|panels/)?", "@/components/audio-ui/"],
  ["ui/", "@/components/ui/"],
  ["hooks/", "@/hooks/"],
  ["lib/", "@/lib/"],
  ["components/", "@/components/examples/"],
];

// The module roots those folders sit under: the per-style copies the design
// system generates, and the base itself.
const SOURCE_ROOTS = [
  `@/registry-audio/bases/__generated/base-(?:${STYLES.join("|")})/`,
  "@/registry(?:-audio)?/bases/base/",
];

const IMPORT_REWRITES = SOURCE_ROOTS.flatMap((root) =>
  INSTALL_FOLDERS.map(
    ([folder, installed]) =>
      [new RegExp(root + folder, "g"), installed] as const
  )
);

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const STYLE_WRAPPER = /\.style-[a-z]+\s*\{([\s\S]*)\}\s*$/;
const APPLY_RULE = /\.([a-zA-Z0-9_-]+)\s*\{\s*@apply\s+([^;]+);\s*\}/g;
const CN_CLASS = /\bcn-[a-zA-Z0-9_-]+\b/;
const CN_CLASSES = new RegExp(CN_CLASS.source, "g");
const EXPORT_DEFAULT = /export default/g;
const DEMO_METADATA =
  /^\s*\/\/\s*(?:Description|Order|GridSize|PreviewHeight):.*$\n?/gm;

// Checks of the verification pass.
const MAX_LINE_LENGTH = 2000;
const SVG_PATH_DATA = /^\s*d ?=/;
const STYLE_TOKEN = new RegExp(`\\bstyle-(?:${STYLES.join("|")}):`);
const REGISTRY_IMPORT = /@\/registry-audio\/|@\/registry\/bases\//;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceFile {
  path: string;
  target?: string;
  type: string;
}

/** An item as `_registry.ts` declares it. */
interface SourceItem {
  categories?: string[];
  cssVars?: Record<string, unknown>;
  dependencies?: string[];
  description?: string;
  devDependencies?: string[];
  files?: SourceFile[];
  name: string;
  registryDependencies?: string[];
  title?: string;
  type: string;
}

interface BuiltFile {
  content: string;
  path: string;
  target: string;
  type: string;
}

/** An item as the registry serves it, keys in the order they are written. */
interface BuiltItem {
  $schema: string;
  cssVars?: Record<string, unknown>;
  dependencies?: string[];
  description?: string;
  devDependencies?: string[];
  files: BuiltFile[];
  name: string;
  registryDependencies?: string[];
  title?: string;
  type: string;
}

/** One style of one base, with the `cn-*` classes it defines. */
interface StyleBuild {
  base: string;
  cnClasses: Map<string, string>;
  name: string;
}

interface Problem {
  detail: string;
  kind: string;
}

// ---------------------------------------------------------------------------
// cn-* class expansion, mirrors how ui.shadcn.com serves its own registry:
// components reference placeholder classes like `cn-fader-track`, defined in
// registry-audio/styles/style-{style}.css (a `.style-{name} { .cn-x { @apply
// ...; } }` block). The official registry never ships that placeholder text,
// it's resolved to real utility classes before the JSON is served, so the
// shadcn CLI never meets a `cn-*` token it has no definition for and would
// silently strip.
// ---------------------------------------------------------------------------

async function readCnClasses(style: string): Promise<Map<string, string>> {
  const classes = new Map<string, string>();
  const css = Bun.file(`${REGISTRY_AUDIO}/styles/style-${style}.css`);
  if (!(await css.exists())) {
    return classes;
  }

  const source = (await css.text()).replace(CSS_COMMENT, "");
  const rules = source.match(STYLE_WRAPPER)?.[1] ?? source;
  for (const [, className, utilities] of rules.matchAll(APPLY_RULE)) {
    classes.set(className, utilities.trim());
  }
  return classes;
}

function expandCnClasses(
  content: string,
  cnClasses: Map<string, string>
): string {
  if (cnClasses.size === 0) {
    return content;
  }
  return content.replace(CN_CLASSES, (token) => cnClasses.get(token) ?? token);
}

// ---------------------------------------------------------------------------
// Items of a base
// ---------------------------------------------------------------------------

async function loadFolder(base: string, folder: string): Promise<SourceItem[]> {
  const path = `${BASES_DIR}/${base}/${folder}/_registry.ts`;
  if (!(await Bun.file(path).exists())) {
    return [];
  }
  const registry: Record<string, SourceItem[] | undefined> = await import(path);
  return registry[folder] ?? [];
}

async function loadItems(base: string): Promise<Map<string, SourceItem>> {
  const folders = await Promise.all(
    REGISTRY_FOLDERS.map((folder) => loadFolder(base, folder))
  );
  return new Map(folders.flat().map((item) => [item.name, item]));
}

// ---------------------------------------------------------------------------
// Manifests: components.json, registry.json and seo.json are DERIVED from
// components/_registry.ts (items) and categories.ts (curated editorial).
// Category counts are computed, never hand-summed. Item tags not listed in
// categories.ts are free-form search tags and are left alone; a curated
// category with zero items fails the build.
// ---------------------------------------------------------------------------

async function buildManifests(): Promise<void> {
  const items = await loadFolder(MANIFEST_BASE, "components");

  const catalog = items.map((item) => ({
    categories: item.categories ?? [],
    name: item.name,
    title: item.title ?? item.name,
  }));

  const categoryEntries = categories.map((category) => {
    const count = items.filter((item) =>
      (item.categories ?? []).includes(category.name)
    ).length;
    if (count === 0) {
      throw new Error(
        `Category "${category.name}" in categories.ts has no catalog items, remove it from categories.ts or tag items with it.`
      );
    }
    return {
      count,
      description: category.description,
      label: category.label,
      name: category.name,
    };
  });

  const seo: Record<string, unknown> = {
    root: {
      description: rootSeo.description,
      intro: rootSeo.intro,
      keywords: rootSeo.keywords,
      title: rootSeo.title,
    },
  };
  for (const category of categories) {
    seo[category.name] = {
      description:
        category.seo?.description ??
        `${category.description} {{count}} components.`,
      intro:
        category.seo?.intro ??
        `Browse {{count}} ${category.label.toLowerCase()} components for audio/ui, built on top of shadcn/ui.`,
      title: category.seo?.title ?? category.label,
    };
  }

  const manifests = {
    "components.json": catalog,
    "registry.json": {
      categories: categoryEntries,
      totalComponents: items.length,
    },
    "seo.json": seo,
  };
  await Promise.all(
    Object.entries(manifests).map(([file, data]) =>
      Bun.write(`${BASES_DIR}/${file}`, `${JSON.stringify(data, null, 2)}\n`)
    )
  );

  // Normalize to the repo's Biome formatting so build then lint is idempotent.
  try {
    await $`bunx biome check --write ${Object.keys(manifests).map((file) => `src/registry-audio/bases/${file}`)}`
      .cwd(PROJECT_ROOT)
      .quiet();
  } catch {
    console.warn("  Manifests: biome formatting pass failed (non-fatal)");
  }

  console.log(
    `  Manifests: components.json (${catalog.length} items), registry.json (${categoryEntries.length} categories, counts derived), seo.json`
  );
}

// ---------------------------------------------------------------------------
// One item, in one style
// ---------------------------------------------------------------------------

function transformImportPaths(code: string): string {
  return IMPORT_REWRITES.reduce(
    (text, [pattern, installed]) => text.replace(pattern, installed),
    code
  )
    .replace(DEMO_METADATA, "")
    .trimStart();
}

/** Where a file lands in a project when its item doesn't say. */
function defaultTarget(item: SourceItem, file: SourceFile, fileName: string) {
  if (isCatalogItemName(item.name)) {
    return `components/examples/${fileName}`;
  }
  switch (file.type) {
    // Every audio/ui component lands in one folder named after the library,
    // imported as `@/components/audio-ui/<name>`.
    case "registry:ui":
      return `components/audio-ui/${fileName}`;
    case "registry:hook":
      return `hooks/${fileName}`;
    case "registry:lib":
      return `lib/${fileName}`;
    default:
      return `components/${fileName}`;
  }
}

async function buildFile(
  file: SourceFile,
  item: SourceItem,
  build: StyleBuild
): Promise<BuiltFile | null> {
  const source = `src/registry-audio/bases/${build.base}/${file.path}`;
  let content: string;
  try {
    content = await Bun.file(`${PROJECT_ROOT}/${source}`).text();
  } catch {
    console.error(`  Failed to read: ${source}`);
    return null;
  }

  // 1. Style-specific classNames (style-vega:bg-white becomes bg-white)
  content = transformStyleClassNames(content, build.name);
  // 2. cn-* placeholder classes become their utility classes
  content = expandCnClasses(content, build.cnClasses);
  // 3. Import paths become the paths the files land at
  content = transformImportPaths(content);
  // 4. export default becomes a named export
  if (file.type !== "registry:page") {
    content = content.replace(EXPORT_DEFAULT, "export");
  }

  const fileName = file.path.slice(file.path.lastIndexOf("/") + 1);
  return {
    content: content.trim(),
    path: fileName,
    target: file.target || defaultTarget(item, file, fileName),
    type: file.type,
  };
}

async function buildItem(
  item: SourceItem,
  build: StyleBuild
): Promise<BuiltItem | null> {
  const files = (
    await Promise.all(
      (item.files ?? []).map((file) => buildFile(file, item, build))
    )
  ).filter((file) => file !== null);

  // A barrel item (`@audio-ui/ui`, `@audio-ui/hooks`) has no files of its own,
  // it only aggregates registryDependencies for a one-shot install, and an
  // alias for a lib that moved into a package only installs that package.
  // Still emit them; skip only when there is nothing to serve at all.
  if (
    files.length === 0 &&
    !item.registryDependencies?.length &&
    !item.dependencies?.length
  ) {
    return null;
  }

  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    cssVars: item.cssVars,
    dependencies: item.dependencies,
    description: item.description,
    devDependencies: item.devDependencies,
    files,
    name: item.name,
    // Our own items are served under the @audio-ui namespace.
    registryDependencies: item.registryDependencies?.map((dependency) =>
      itemNames.has(dependency) ? `${NAMESPACE}/${dependency}` : dependency
    ),
    title: item.title,
    type: item.type,
  };
}

/** An item as `registry.json` lists it: no `$schema`, no file contents. */
function indexEntry(item: BuiltItem) {
  const { $schema: _schema, ...entry } = item;
  return {
    ...entry,
    files: item.files.map(({ path, target, type }) => ({ path, target, type })),
  };
}

// ---------------------------------------------------------------------------
// One style: build every item, write it, list it
// ---------------------------------------------------------------------------

async function emitItem(name: string, build: StyleBuild) {
  const item = itemsByBase.get(build.base)?.get(name);
  const built = item ? await buildItem(item, build) : null;
  if (!built) {
    return null;
  }
  const bytes = await Bun.write(
    `${OUTPUT_ROOT}/${build.name}/${name}.json`,
    JSON.stringify(built)
  );
  return { built, bytes };
}

async function buildStyle(build: StyleBuild) {
  const names = [...itemNames];
  const outcomes = await Promise.allSettled(
    names.map((name) => emitItem(name, build))
  );

  const emitted = outcomes.flatMap((outcome) =>
    outcome.status === "fulfilled" && outcome.value ? [outcome.value] : []
  );
  const failures = outcomes.flatMap((outcome, index) =>
    outcome.status === "rejected"
      ? [{ name: names[index], reason: outcome.reason }]
      : []
  );
  for (const { name, reason } of failures) {
    console.error(`  Error building ${build.name}/${name}:`, reason);
  }

  // registry.json lists the style's items for `shadcn search` and `list`.
  await Bun.write(
    `${OUTPUT_ROOT}/${build.name}/registry.json`,
    JSON.stringify({
      $schema: "https://ui.shadcn.com/schema/registry.json",
      homepage: HOMEPAGE,
      items: emitted.map(({ built }) => indexEntry(built)),
      name: "audio-ui",
    })
  );

  return {
    bytes: emitted.reduce((total, { bytes }) => total + bytes, 0),
    errors: failures.length,
    files: emitted.length,
    name: build.name,
  };
}

// ---------------------------------------------------------------------------
// Verification pass: read back every generated JSON and check its integrity
// ---------------------------------------------------------------------------

function contentProblems({ content, path }: BuiltFile): Problem[] {
  const problems: Problem[] = [];

  // Collapsed code: a line this long is a minified or unformatted file. SVG
  // path data is legitimately long.
  const lines = content.split("\n");
  const collapsed = lines.findIndex(
    (line) => line.length > MAX_LINE_LENGTH && !SVG_PATH_DATA.test(line)
  );
  if (collapsed !== -1) {
    problems.push({
      detail: `line ${collapsed + 1} is ${lines[collapsed]?.length} chars (file "${path}")`,
      kind: "COLLAPSED CODE",
    });
  }
  // Everything below must have been resolved while building.
  if (STYLE_TOKEN.test(content)) {
    problems.push({
      detail: "still contains style-*: tokens",
      kind: "UNTRANSFORMED STYLE",
    });
  }
  if (CN_CLASS.test(content)) {
    problems.push({
      detail: "still contains cn-* tokens",
      kind: "UNEXPANDED CN CLASS",
    });
  }
  if (REGISTRY_IMPORT.test(content)) {
    problems.push({
      detail: "still contains registry import paths",
      kind: "UNTRANSFORMED IMPORT",
    });
  }
  return problems;
}

function findProblems(data: Partial<BuiltItem>): Problem[] {
  if (!(data.name && data.type && Array.isArray(data.files))) {
    return [{ detail: "missing name, type, or files", kind: "INVALID SCHEMA" }];
  }

  // The files before an empty one are checked, the ones after are not.
  const emptyAt = data.files.findIndex(
    (file) => !file.content || typeof file.content !== "string"
  );
  const checked = emptyAt === -1 ? data.files : data.files.slice(0, emptyAt);
  const problems = checked.flatMap(contentProblems);

  const empty = data.files[emptyAt];
  if (empty) {
    problems.push({
      detail: `file "${empty.path}" has no content`,
      kind: "EMPTY CONTENT",
    });
  }
  return problems;
}

/** Reads a style's folder back and returns what it found, printable. */
async function verifyStyle(styleName: string) {
  const dir = `${OUTPUT_ROOT}/${styleName}`;
  const entries = (
    await Array.fromAsync(new Bun.Glob("*.json").scan({ cwd: dir }))
  )
    .filter((entry) => entry !== "registry.json")
    .sort();

  const problems = await Promise.all(
    entries.map(async (entry) => {
      const label = `${styleName}/${entry}`;
      try {
        const data = await Bun.file(`${dir}/${entry}`).json();
        return findProblems(data).map(({ detail, kind }) => ({
          label,
          message: `${kind}: ${label}, ${detail}`,
        }));
      } catch (error) {
        return [{ label, message: `INVALID JSON: ${label}: ${error}` }];
      }
    })
  );

  return { checked: entries.length, problems: problems.flat() };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const itemsByBase = new Map(
  await Promise.all(
    BASES.map(async ({ name }) => [name, await loadItems(name)] as const)
  )
);
// Every item name, once, in the order the registry lists them.
const itemNames = new Set(
  [...itemsByBase.values()].flatMap((items) => [...items.keys()])
);

const startedAt = Date.now();
console.log("Building static registry...");
await buildManifests();
console.log(`  Internal registry namespace: ${NAMESPACE}`);

const cnClassesByStyle = new Map(
  await Promise.all(
    STYLES.map(async (style) => [style, await readCnClasses(style)] as const)
  )
);
const builds: StyleBuild[] = BASES.flatMap(({ name: base }) =>
  STYLES.map((style) => ({
    base,
    cnClasses: cnClassesByStyle.get(style) ?? new Map(),
    name: `${base}-${style}`,
  }))
);

console.log(`  Styles: ${builds.length}`);
console.log(`  Items: ${itemNames.size}`);
console.log(`  Total files to generate: ${builds.length * itemNames.size}`);
console.log(`  Default style: ${DEFAULT_STYLE} (served via redirect)`);
console.log();

// Start from an empty output folder, so an item that was removed is gone.
await $`rm -rf ${OUTPUT_ROOT}`.quiet();

const styles = await Promise.all(builds.map(buildStyle));
for (const { files, name } of styles) {
  console.log(`  ${name}: ${files} files`);
}

// The `default` style is a redirect to DEFAULT_STYLE, not a copy.
await Bun.write(
  `${OUTPUT_ROOT}/index.json`,
  JSON.stringify(
    [
      { label: "Default", name: "default" },
      ...builds.map(({ name }) => ({
        label: name
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        name,
      })),
    ],
    null,
    2
  )
);

console.log();
console.log("Verifying generated files...");
const verification = await Promise.all(
  builds.map(({ name }) => verifyStyle(name))
);
const problems = verification.flatMap((style) => style.problems);
for (const { message } of problems) {
  console.error(`  ${message}`);
}
console.log(
  `  Verified: ${verification.reduce((total, { checked }) => total + checked, 0)} files`
);
if (problems.length > 0) {
  const affected = [...new Set(problems.map(({ label }) => label))];
  console.error(
    `  Verification FAILED: ${problems.length} issues in ${affected.length} files`
  );
  console.error(`  Affected: ${affected.join(", ")}`);
  process.exit(1);
}
console.log("  All files passed verification");

const totalFiles = styles.reduce((total, { files }) => total + files, 0);
const totalBytes = styles.reduce((total, { bytes }) => total + bytes, 0);
const errors = styles.reduce((total, style) => total + style.errors, 0);

console.log();
console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
console.log(`  Total files: ${totalFiles}`);
console.log(`  Total size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
if (errors > 0) {
  console.log(`  Build errors: ${errors}`);
  process.exit(1);
}
