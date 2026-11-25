/**
 * Build Static Registry
 *
 * Pre-compiles every registry item (the audio components, hooks and lib items,
 * and the catalog blocks and demos under `registry/bases/{base}`) into
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
import { transformStyleClassNames } from "../src/lib/code/code-utils.ts";
import { isCatalogItemName } from "../src/lib/registry/catalog/catalog-name.ts";
import { categories, rootSeo } from "../src/registry/bases/categories.ts";
import { HOOK_GROUPS, LIB_GROUPS } from "../src/registry/bases/items.ts";
import {
  moduleDependencies,
  rewriteModuleImports,
} from "../src/registry/bases/modules.ts";
import {
  rewriteAdapter,
  rewritePrimitiveImports,
  SHARED_ITEMS,
  SHIPPED_PRIMITIVES,
  sharedDependencies,
} from "../src/registry/bases/primitives.ts";
import { HARDWARE_CSS } from "../src/registry/bases/shared/audio-ui/skins/hardware-css.ts";
import { BASES as ALL_BASES } from "../src/registry/bases.ts";
import { skinSheet } from "./skin-css.ts";

// ---------------------------------------------------------------------------
// Where things are
// ---------------------------------------------------------------------------

const PROJECT_ROOT = `${import.meta.dir}/..`;
const REGISTRY = `${PROJECT_ROOT}/src/registry`;
const BASES_DIR = `${REGISTRY}/bases`;
const OUTPUT_ROOT = `${PROJECT_ROOT}/public/r/styles`;

const NAMESPACE = "@audio-ui";
const HOMEPAGE = "https://www.audio-ui.dev";
const DEFAULT_STYLE = "base-nova";

// Every base serves the items of `bases/shared/`, which name no behavior library and drive the manifests, beside its own: the `ui/` components its style is made of and the variants of the items that name its library.
const BASES = ALL_BASES;
const SHARED = "shared";
/** The folders at the registry root that every base serves: a file path that starts with it is read from there, the others from `bases/`. */
const ROOT_FOLDERS = ["lib", "primitives"];
const isRootPath = (path: string) =>
  ROOT_FOLDERS.some((folder) => path.startsWith(`${folder}/`));
const UI_BASE = "ui-sdk";

// Style names only: `registry/styles.tsx` also holds inline JSX icon SVGs that
// can't be evaluated here, and the set is `registry/styles/style-*.css`.
const STYLES = ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"];

// The folders of a base that hold registry items. Each `_registry.ts` exports
// an array named after its folder, in camel case (`audioUi` for `audio-ui`); a later folder wins on a repeated name.
const REGISTRY_FOLDERS = [
  "audio-ui",
  "devices",
  "hooks",
  "components",
  "lib",
  "primitives",
  "ui",
];

// A folder a registry file imports from, and where it lands in a project. The longest first: `audio-ui/` is every folder of audio.
const INSTALL_PREFIXES: [prefix: string, installed: string][] = [
  ["audio-ui/elements/", "@/components/audio-ui/"],
  ["audio-ui/panels/", "@/components/audio-ui/"],
  ["audio-ui/", "@/components/audio-ui/"],
  ["ui/", "@/components/ui/"],
  ["hooks/", "@/hooks/"],
  ["lib/", "@/lib/"],
  ["components/", "@/components/examples/"],
];

// A module of a source tree, by what follows its root: the per-style copies the design system generates, the bases themselves, and `lib/` at the registry root. One pass finds every import of a file, where a pattern for each file of the registry read it a thousand times over.
const SOURCE_MODULE = new RegExp(
  `@/registry/(?:bases/(?:__generated/base-(?:${STYLES.join("|")})|shared|base|ui-sdk)/|(?=(?:lib|primitives)/))([^"'\`\\s]*)`,
  "g"
);

// A lib or a hook written in a group folder installs beside the others: `lib/notes/note-edits` is `@/lib/note-edits`.
const GROUP_MODULE = new RegExp(
  `^(lib/(?:${Object.keys(LIB_GROUPS).join("|")})|hooks/(?:${Object.keys(HOOK_GROUPS).join("|")}))/([^/]+)$`
);

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const STYLE_WRAPPER = /\.style-[a-z]+\s*\{([\s\S]*)\}\s*$/;
const APPLY_RULE = /\.([a-zA-Z0-9_-]+)\s*\{\s*@apply\s+([^;]+);\s*\}/g;
const CN_CLASS = /\bcn-[a-zA-Z0-9_-]+\b/;
const CN_CLASSES = new RegExp(CN_CLASS.source, "g");
const EXPORT_DEFAULT = /export default/g;
// The state attributes the style hooks are written against, and the ones ui-sdk's parts carry instead.
const GROUP_ORIENTATION = /group-data-(horizontal|vertical)\//g;
const ORIENTATION = /(?<![\w\]-])data-(horizontal|vertical):/g;
const ACTIVE = /(?<![\w-])data-active\b/g;
// The same attribute as a bracket variant, `in-data-[active]:` or `group-data-[active]/cursor:`, which the audio hooks use for a primitive's part: renamed with it.
const ACTIVE_VARIANT = /\bdata-\[active\]/g;
const POPUP_OPEN = /\bdata-popup-open\b/g;
// input-otp marks its active slot `data-active="true"`, ui-sdk with a bare `data-active`.
const ACTIVE_TRUE = /\bdata-\[active=true\]/g;
// vaul names a drawer's edge `data-vaul-drawer-direction`, ui-sdk `data-side`.
const DRAWER_DIRECTION = /\bdata-\[vaul-drawer-direction=/g;
const DEMO_METADATA =
  /^\s*\/\/\s*(?:Description|Order|GridSize|PreviewHeight):.*$\n?/gm;

// Checks of the verification pass.
const MAX_LINE_LENGTH = 2000;
const SVG_PATH_DATA = /^\s*d ?=/;
// A bundle the engine ships as a string (`bun run engine:worklet` writes it): one long line by design.
const BUNDLED_SOURCE = /-source\.ts$/;
const STYLE_TOKEN = new RegExp(`\\bstyle-(?:${STYLES.join("|")}):`);
const REGISTRY_IMPORT = /@\/registry\/(?:bases|lib|primitives)\//;

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
  css?: Record<string, unknown>;
  cssVars?: Record<string, unknown>;
  dependencies?: string[];
  description?: string;
  devDependencies?: string[];
  files?: SourceFile[];
  name: string;
  /** The folder of `bases/` that holds the item's files, when it is not the base built. */
  origin?: string;
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
  css?: Record<string, unknown>;
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

const DASH_LETTER = /-([a-z])/g;

interface Problem {
  detail: string;
  kind: string;
}

// ---------------------------------------------------------------------------
// cn-* class expansion, mirrors how ui.shadcn.com serves its own registry:
// components reference placeholder classes like `cn-fader-track`, defined in
// registry/styles/audio/style-{style}.css (a `.style-{name} { .cn-x { @apply
// ...; } }` block). The official registry never ships that placeholder text,
// it's resolved to real utility classes before the JSON is served, so the
// shadcn CLI never meets a `cn-*` token it has no definition for and would
// silently strip.
// ---------------------------------------------------------------------------

async function readCnClasses(style: string): Promise<Map<string, string>> {
  const classes = new Map<string, string>();
  // The hooks of the audio components, then those of the ui components: `registry/styles` is the shadcn-derived set the `ui-sdk` base's own components use.
  const files = await Promise.all(
    [
      `${REGISTRY}/styles/audio/style-${style}.css`,
      `${REGISTRY}/styles/style-${style}.css`,
    ].map(async (path) => {
      const css = Bun.file(path);
      return (await css.exists()) ? await css.text() : "";
    })
  );
  for (const css of files) {
    const source = css.replace(CSS_COMMENT, "");
    const rules = source.match(STYLE_WRAPPER)?.[1] ?? source;
    for (const [, className, utilities] of rules.matchAll(APPLY_RULE)) {
      if (!classes.has(className)) {
        classes.set(className, utilities.trim());
      }
    }
  }
  return classes;
}

/**
 * The hooks of a style name the attributes of the parts they were written for: ui-sdk's parts carry others.
 * `forUiSdk`: a file written for ui-sdk, whose own `data-[active]` is ui-sdk's.
 */
function toUiSdkAttributes(content: string, forUiSdk: boolean): string {
  const renamed = content.replace(ACTIVE, "data-selected");
  return (
    forUiSdk ? renamed : renamed.replace(ACTIVE_VARIANT, "data-[selected]")
  )
    .replace(GROUP_ORIENTATION, "group-data-[orientation=$1]/")
    .replace(ORIENTATION, "data-[orientation=$1]:")
    .replace(POPUP_OPEN, "data-open")
    .replace(ACTIVE_TRUE, "data-[active]")
    .replace(DRAWER_DIRECTION, "data-[side=");
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

const camelCase = (name: string) =>
  name.replace(DASH_LETTER, (_, letter: string) => letter.toUpperCase());

async function loadFolder(base: string, folder: string): Promise<SourceItem[]> {
  // `lib/` is the registry's own, at its root: every base serves it.
  const root = ROOT_FOLDERS.includes(folder);
  if (root && base !== SHARED) {
    return [];
  }
  const path = `${root ? REGISTRY : `${BASES_DIR}/${base}`}/${folder}/_registry.ts`;
  if (!(await Bun.file(path).exists())) {
    return [];
  }
  const registry: Record<string, SourceItem[] | undefined> = await import(path);
  return registry[camelCase(folder)] ?? [];
}

async function loadItems(base: string): Promise<Map<string, SourceItem>> {
  // Each base publishes its own ui components: a base takes the others from shadcn.
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

/** An item without a title is named by its slug, read as words: `block-delay` is `Block delay`. */
function readableTitle(name: string) {
  const words = name.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function buildManifests(): Promise<void> {
  const items = await loadFolder(SHARED, "components");

  const catalog = items.map((item) => ({
    categories: item.categories ?? [],
    description: item.description ?? "",
    name: item.name,
    title: item.title ?? readableTitle(item.name),
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
    await $`bunx biome check --write ${Object.keys(manifests).map((file) => `src/registry/bases/${file}`)}`
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

/** Each import of a source tree becomes where it installs: a file that says where it lands (`explicitTargets`) by its own address, any other by its folder. */
function rewriteSourceImports(code: string): string {
  return code.replace(
    SOURCE_MODULE,
    (module, path: string, offset: number, text: string) => {
      // Only a whole address, closed by its quote, is a file's own.
      const installed =
        text[offset + module.length] === '"'
          ? explicitTargets.get(path)
          : undefined;
      if (installed !== undefined) {
        return installed;
      }
      const flat = GROUP_MODULE.exec(path);
      if (flat) {
        return `@/${flat[1]?.split("/")[0]}/${flat[2]}`;
      }
      for (const [prefix, folder] of INSTALL_PREFIXES) {
        if (path.startsWith(prefix)) {
          return folder + path.slice(prefix.length);
        }
      }
      return module;
    }
  );
}

function transformImportPaths(code: string): string {
  return rewriteSourceImports(code).replace(DEMO_METADATA, "").trimStart();
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
  const source = isRootPath(file.path)
    ? `src/registry/${file.path}`
    : `src/registry/bases/${item.origin ?? build.base}/${file.path}`;
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
  if (build.base === UI_BASE) {
    content = toUiSdkAttributes(content, source.includes(`/bases/${UI_BASE}/`));
  }
  // 3. Import paths become the paths the files land at
  content = transformImportPaths(content);
  // 4. export default becomes a named export
  if (file.type !== "registry:page") {
    content = content.replace(EXPORT_DEFAULT, "export");
  }
  // 5. An adapter of a primitive written in the registry imports it by a relative path
  const adapter = ADAPTER_ITEM.exec(item.name);
  if (adapter?.[1] && SHIPPED_PRIMITIVES.has(adapter[1])) {
    content = rewriteAdapter(adapter[1], adapter[2] ?? "", content);
  } else {
    // 6. Any other file imports such a primitive where its adapter installs it
    content = rewritePrimitiveImports(
      content,
      file.path.includes("/svelte/") || file.path.endsWith(".svelte")
    );
  }

  // 7. A module of the engine or of webgl is imported where it installs, `@/lib/engine/<module>`
  content = rewriteModuleImports(content);

  const fileName = file.path.slice(file.path.lastIndexOf("/") + 1);
  const target = file.target || defaultTarget(item, file, fileName);
  // 8. A path the CLI would shorten to the file itself is relative to where the file lands
  if (!target.startsWith("~/")) {
    content = relativizeRepeatedImports(content, target);
  }
  return {
    content: content.trim(),
    path: fileName,
    target,
    type: file.type,
  };
}

const REPEATED_IMPORT = /(["'])@\/components\/audio-ui\/([a-z-]+)\/\2\1/g;

/** `to` from the folder `from`, both relative to the project: `../plot/plot`. */
function relativePath(from: string, to: string) {
  const source = from.split("/").filter(Boolean);
  const target = to.split("/").filter(Boolean);
  let shared = 0;
  while (
    shared < source.length &&
    shared < target.length - 1 &&
    source[shared] === target[shared]
  ) {
    shared += 1;
  }
  const up = source.slice(shared).map(() => "..");
  const path = [...up, ...target.slice(shared)].join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

/**
 * The shadcn CLI turns an import of `@/components/audio-ui/<name>/<name>` into
 * `@/components/audio-ui/<name>`, which for an element named as its primitive
 * (`plot.tsx` over `plot/plot.ts`) is the file itself. A file that imports a
 * primitive by that path imports it by a relative path instead, from where the
 * file installs, which the CLI leaves as it is.
 */
function relativizeRepeatedImports(content: string, target: string) {
  const directory = target.slice(0, target.lastIndexOf("/"));
  return content.replace(
    REPEATED_IMPORT,
    (_match, quote: string, name: string) =>
      `${quote}${relativePath(directory, `components/audio-ui/${name}/${name}`)}${quote}`
  );
}

/**
 * The item's own dependencies, and the shared items that install what its
 * files import from the primitives (`pitch`, `piano-roll-edits`…): the
 * import is the declaration, so it cannot be left out. An item that ships a
 * file itself does not ask for it.
 */
function withSharedItems(item: SourceItem, files: BuiltFile[]) {
  const own = new Set(files.map((file) => file.target));
  const needed = files
    .flatMap((file) => [
      ...sharedDependencies(file.content),
      ...moduleDependencies(file.content),
    ])
    .filter((name) => {
      const shared = SHARED_ITEMS[name];
      // A module of the engine or of webgl is installed by its own item, never shipped by another.
      if (!shared) {
        return name !== item.name;
      }
      const targets = shared.files.map((file) => `components/audio-ui/${file}`);
      return !targets.every((target) => own.has(target)) && name !== item.name;
    });
  if (needed.length === 0) {
    return item.registryDependencies;
  }
  return [...new Set([...(item.registryDependencies ?? []), ...needed])];
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
    css: item.css,
    cssVars: item.cssVars,
    dependencies: item.dependencies,
    description: item.description,
    devDependencies: item.devDependencies,
    files,
    name: item.name,
    // Our own items are served under the @audio-ui namespace.
    registryDependencies: withSharedItems(item, files)?.map((dependency) => {
      const shadcn = SHADCN_DEPENDENCY.exec(dependency)?.[1];
      if (shadcn && itemsByBase.get(build.base)?.has(shadcn)) {
        return `${NAMESPACE}/${shadcn}`;
      }
      return itemNames.has(dependency)
        ? `${NAMESPACE}/${dependency}`
        : dependency;
    }),
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
  const item = itemOf(name, build.base);
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
  const collapsed = BUNDLED_SOURCE.test(path)
    ? -1
    : lines.findIndex(
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

// The items of `bases/shared/` first, then each base's own.
const itemsByBase = new Map(
  await Promise.all(
    [SHARED, ...BASES.map(({ name }) => name)].map(
      async (name) => [name, await loadItems(name)] as const
    )
  )
);
// A file that says where it installs (`target`) is imported from there: its
// source module becomes that path, before the folder rules above apply.
const SOURCE_EXTENSION = /\.tsx?$/;
const INDEX_FILE = /\/index$/;
const ADAPTER_ITEM = /^([a-z-]+)-(react|vue|svelte|web)$/;
const SVELTE_ROOT = /^~\/src\/lib\//;
const explicitTargets = new Map<string, string>();
for (const item of [...itemsByBase.values()].flatMap((items) => [
  ...items.values(),
])) {
  for (const file of item.files ?? []) {
    if (!file.target) {
      continue;
    }
    // A Svelte file lands under `$lib/components` (shadcn-svelte).
    const svelte = file.path.includes("/svelte/");
    const target = file.target.replace(SOURCE_EXTENSION, "");
    const installed = svelte
      ? `$lib/${target.replace(SVELTE_ROOT, "").replace(INDEX_FILE, "")}`
      : `@/${target}`;
    const source = file.path.replace(SOURCE_EXTENSION, "");
    // A folder's index is imported as the folder. A path two items write goes where the first says.
    for (const from of INDEX_FILE.test(source)
      ? [source, source.replace(INDEX_FILE, "")]
      : [source]) {
      if (!explicitTargets.has(from)) {
        explicitTargets.set(from, installed);
      }
    }
  }
}
// Every item name, once, in the order the registry lists them.
const itemNames = new Set(
  [...itemsByBase.values()].flatMap((items) => [...items.keys()])
);

// A base serves its own items and, beside them, every item of `bases/shared/`. Each base answers their `@shadcn/<name>` dependencies with its own components, and leaves to shadcn the ones it has none of.
const SHADCN_DEPENDENCY = /^@shadcn\/([a-z-]+)$/;
function itemOf(name: string, base: string): SourceItem | undefined {
  const own = itemsByBase.get(base)?.get(name);
  if (own) {
    return own;
  }
  const shared = itemsByBase.get(SHARED)?.get(name);
  return shared && { ...shared, origin: SHARED };
}

const startedAt = Date.now();
console.log("Building static registry...");
await buildManifests();
await Bun.write(
  `${REGISTRY}/styles/skins/hardware.css`,
  skinSheet(HARDWARE_CSS)
);
console.log(`  Internal registry namespace: ${NAMESPACE}`);

const cnClassesByStyle = new Map(
  await Promise.all(
    STYLES.map(async (style) => [style, await readCnClasses(style)] as const)
  )
);
// A hook one style leaves out (lyra has no `cn-dialog-footer`) is empty there, not left in the file.
const everyHook = new Set(
  [...cnClassesByStyle.values()].flatMap((classes) => [...classes.keys()])
);
for (const classes of cnClassesByStyle.values()) {
  for (const hook of everyHook) {
    if (!classes.has(hook)) {
      classes.set(hook, "");
    }
  }
}
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
