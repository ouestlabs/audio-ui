import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * The logic of a primitive as a registry ships it: the files it is made of,
 * from `@audio-ui/primitives` and the modules of `@audio-ui/core` it reads,
 * each at a path in the user's project, with the imports between them written
 * as relative paths so they resolve with no alias and no package of ours.
 *
 * Two items that carry the same file write it at the same path with the same
 * content, which the CLI skips, so a project that installs two primitives
 * holds each shared file once.
 */

const PACKAGES = resolve(import.meta.dir, "../../../../../packages");
const SOURCE = /\.(?:svelte|tsx?)$/;

/** The primitives whose logic ships in their items, instead of coming from the packages. */
export const LOGIC_PRIMITIVES = new Set(["knob"]);

/** Where the logic lands in a project, under `lib/`. */
const FOLDER = "lib/audio-ui";
/** The same for Svelte: both of its CLIs write a `~/` target from the project's root, where `lib/` would go under `src/lib`. */
export const SVELTE_FOLDER = "~/src/lib/audio-ui";

/** The file a bare import of ours stands for, or `null` for any other package. */
function resolveBare(specifier: string): string | null {
  const match = /^@audio-ui\/(core|primitives)(?:\/(.+))?$/.exec(specifier);
  if (!match) {
    return null;
  }
  const [, pkg, sub] = match;
  const base = join(PACKAGES, pkg ?? "", "src");
  const candidates =
    pkg === "core"
      ? [
          join(base, "primitives", sub ?? "", "index.ts"),
          join(base, sub ?? "", "index.ts"),
          join(base, `${sub}.ts`),
        ]
      : [join(base, sub ?? "", "index.ts"), join(base, `${sub}.ts`)];
  return sub ? (candidates.find(existsSync) ?? null) : join(base, "index.ts");
}

/** The file an import of `file` stands for, or `null` for a package of a third party. */
function resolveImport(file: string, specifier: string): string | null {
  if (specifier.startsWith(".")) {
    const path = resolve(dirname(file), specifier);
    return (
      [path, `${path}.ts`, join(path, "index.ts")].find(
        (candidate) => existsSync(candidate) && SOURCE.test(candidate)
      ) ?? null
    );
  }
  return resolveBare(specifier);
}

const importsOf = (file: string) =>
  [
    ...readFileSync(file, "utf8").matchAll(
      /(?:from|import)\s*["']([^"']+)["']/g
    ),
  ].map((match) => match[1] ?? "");

/** Every file of the logic of a primitive, by absolute path. */
export function logicFiles(primitive: string): string[] {
  const seen = new Set<string>();
  const stack = [join(PACKAGES, "primitives/src", primitive, "index.ts")];
  while (stack.length > 0) {
    const file = stack.pop() ?? "";
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    for (const specifier of importsOf(file)) {
      const next = resolveImport(file, specifier);
      if (next) {
        stack.push(next);
      }
    }
  }
  return [...seen].sort();
}

/** Where a file of the packages lands in a project: `lib/audio-ui/<package>/<path in its src>`. */
export function targetOf(file: string, folder = FOLDER) {
  const inPrimitives = file.startsWith(join(PACKAGES, "primitives/src"));
  const pkg = inPrimitives ? "primitives" : "core";
  return join(folder, pkg, relative(join(PACKAGES, pkg, "src"), file));
}

/** The path of a file of the packages from the registry's own folder, as an item names it. */
export const sourceOf = (file: string) =>
  relative(resolve(import.meta.dir, "base"), file);

/** An import as a path from a folder to a target, with no extension, as a bundler reads it. */
function specifierTo(fromFolder: string, target: string) {
  const path = relative(fromFolder, target).replace(/\.tsx?$/, "");
  return path.startsWith(".") ? path : `./${path}`;
}

/** What a file's imports become, by specifier, for the files that land where `from` says. */
function rewritesFor(file: string, from: string, folder: string) {
  const rewrites = new Map<string, string>();
  for (const specifier of importsOf(file)) {
    const target = resolveImport(file, specifier);
    if (target && !specifier.startsWith("@ui-sdk")) {
      rewrites.set(
        specifier,
        specifierTo(dirname(from), targetOf(target, folder))
      );
    }
  }
  return rewrites;
}

/** The text of a file with the imports it makes written as `rewrites` says. */
function apply(content: string, rewrites: Map<string, string>) {
  let text = content;
  for (const [specifier, replacement] of rewrites) {
    text = text.replaceAll(`"${specifier}"`, `"${replacement}"`);
  }
  return text;
}

/** A file of the logic, as it installs. */
export function rewriteLogic(file: string, content: string, folder = FOLDER) {
  return apply(content, rewritesFor(file, targetOf(file, folder), folder));
}

/** Where an adapter's file sits, for the paths from it to the logic: Svelte keeps its parts inside `lib`, the others beside it. */
const adapterFolder = (primitive: string, framework: string) =>
  framework === "svelte"
    ? `src/lib/components/audio-ui/${primitive}/svelte`
    : `components/audio-ui/${primitive}`;

/** An adapter's file, with the packages of ours it imports written as paths to the logic. */
export function rewriteAdapter(
  primitive: string,
  framework: string,
  content: string
) {
  const rewrites = new Map<string, string>();
  const folder = adapterFolder(primitive, framework);
  // Svelte's logic is under `src/lib`, as its `~/` target says.
  const logicFolder =
    framework === "svelte" ? SVELTE_FOLDER.replace("~/", "") : FOLDER;
  for (const specifier of [
    ...content.matchAll(/["'](@audio-ui\/(?:core|primitives)[^"']*)["']/g),
  ].map((match) => match[1] ?? "")) {
    const target = resolveBare(specifier);
    if (target) {
      rewrites.set(
        specifier,
        specifierTo(folder, targetOf(target, logicFolder))
      );
    }
  }
  return apply(content, rewrites);
}
