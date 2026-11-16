/**
 * The logic of a primitive as a registry ships it: files written by hand in
 * `base/logic/`, each installed at a path under `lib/audio-ui/logic/`, that
 * import one another by relative paths with no extension, so they resolve in
 * a project with no alias and no package of ours.
 *
 * A file shared by two primitives (`define.ts`, `shared.ts`) is the same
 * file in both items, written at the same path with the same content, which
 * the CLI skips, so a project that installs two primitives holds it once.
 */

const TS_EXTENSION = /\.tsx?$/;
const LEADING_CURRENT = /^\.\/\.\./;
const OUR_PACKAGES = /["']@audio-ui\/(?:core|primitives)\/[^"']*["']/g;

/** The files of each primitive's logic, from `base/logic/`. A primitive listed here needs no package of ours. */
const LOGIC: Record<string, string[]> = {
  fader: ["define.ts", "shared.ts", "fader/fader.ts"],
  knob: ["define.ts", "shared.ts", "knob/knob.ts"],
};

/** The primitives whose logic ships in their items. */
export const LOGIC_PRIMITIVES = new Set(Object.keys(LOGIC));

/** Where the logic lands in a project, under `lib/`. */
const FOLDER = "lib/audio-ui/logic";
/** The same for Svelte: both of its CLIs write a `~/` target from the project's root, where `lib/` would go under `src/lib`. */
export const SVELTE_FOLDER = "~/src/lib/audio-ui/logic";

/** The files of a primitive's logic, by path from `base/logic/`. */
export const logicFiles = (primitive: string) => LOGIC[primitive] ?? [];

/** Where a file of the logic lands in a project. */
export const targetOf = (file: string, folder = FOLDER) => `${folder}/${file}`;

/** The path of a file of the logic from the registry's `base/` folder, as an item names it. */
export const sourceOf = (file: string) => `logic/${file}`;

/** The file every import of ours in an adapter stands for: the primitive's own, which also holds what its core module exported. */
const entryOf = (primitive: string) => `${primitive}/${primitive}`;

/** Where an adapter's file sits, for the paths from it to the logic: Svelte keeps its parts inside `lib`, the others beside it. */
const adapterFolder = (primitive: string, framework: string) =>
  framework === "svelte"
    ? `src/lib/components/audio-ui/${primitive}/svelte`
    : `components/audio-ui/${primitive}`;

/** The path from one folder to a file, with no extension, as a bundler reads it. */
function specifierTo(fromFolder: string, target: string) {
  const parts = fromFolder.split("/");
  const goal = target.replace(TS_EXTENSION, "").split("/");
  while (parts.length > 0 && parts[0] === goal[0]) {
    parts.shift();
    goal.shift();
  }
  return `${parts.map(() => "..").join("/") || "."}/${goal.join("/")}`.replace(
    LEADING_CURRENT,
    ".."
  );
}

/** An adapter's file, with the packages of ours it imports written as the path to the logic. */
export function rewriteAdapter(
  primitive: string,
  framework: string,
  content: string
) {
  const logicFolder =
    framework === "svelte" ? SVELTE_FOLDER.replace("~/", "") : FOLDER;
  const path = specifierTo(
    adapterFolder(primitive, framework),
    `${logicFolder}/${entryOf(primitive)}`
  );
  return content.replace(OUR_PACKAGES, `"${path}"`);
}
