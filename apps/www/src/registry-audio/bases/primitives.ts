/**
 * A primitive as the registry ships it: one file written by hand,
 * `base/primitives/<name>/<name>.ts`, over `base/primitives/primitive.ts`,
 * installed with each adapter in the same layout, `components/audio-ui/`
 * (`src/lib/components/audio-ui/` in Svelte). Its relative imports resolve as
 * written, with no alias and no package of ours.
 *
 * `primitive.ts` is the same file in every primitive's items, written at the
 * same path with the same content, which the CLI skips, so a project that
 * installs two primitives holds it once.
 */

import { dirname, relative } from "node:path/posix";

const OUR_PACKAGES = /["'](?:@audio-ui\/core\/|@\/primitives\/)[^"']*["']/g;

/** The primitives written in the registry. A primitive listed here needs no package of ours. */
export const SHIPPED_PRIMITIVES = new Set([
  "envelope",
  "fader",
  "knob",
  "meter",
  "pad",
  "piano",
  "piano-roll",
  "plot",
  "sequencer",
  "timeline",
  "waveform",
  "xypad",
]);

/** The files a large primitive keeps beside its own, by subject, and the shared grid it reads. */
const MORE_FILES: Record<string, string[]> = {
  envelope: ["envelope/geometry.ts"],
  meter: ["meter/levels.ts"],
  piano: ["pitch.ts"],
  "piano-roll": [
    "pitch.ts",
    "grid.ts",
    "piano-roll/controller.ts",
    "piano-roll/edits.ts",
    "piano-roll/rows.ts",
  ],
  timeline: [
    "frame.ts",
    "grid.ts",
    "timeline/clip-controller.ts",
    "timeline/clip.ts",
    "timeline/clips.ts",
    "timeline/edge-scroll.ts",
    "timeline/layout.ts",
    "timeline/locators.ts",
    "timeline/navigator-controller.ts",
    "timeline/navigator.ts",
    "timeline/position.ts",
    "timeline/range-controller.ts",
    "timeline/ranges.ts",
    "timeline/scale.ts",
    "timeline/track-controller.ts",
    "timeline/wheel-zoom.ts",
  ],
  waveform: [
    "frame.ts",
    "grid.ts",
    "waveform/bar-layout.ts",
    "waveform/level-history.ts",
    "waveform/levels-engine.ts",
    "waveform/levels.ts",
    "waveform/paint-bars.ts",
    "waveform/paint-canvas.ts",
    "waveform/peaks.ts",
    "waveform/scope.ts",
  ],
};

/** The files of a primitive, by path from `base/primitives/`. */
export const primitiveFiles = (name: string) => [
  "primitive.ts",
  `${name}/${name}.ts`,
  ...(MORE_FILES[name] ?? []),
];

/**
 * An adapter's file, with the packages of ours it imports written as the path
 * to its primitive: beside it (`audio-ui/knob/react.tsx` imports `./knob`), or
 * one folder up from Svelte's parts (`audio-ui/knob/svelte/`).
 */
export function rewriteAdapter(
  primitive: string,
  framework: string,
  content: string
) {
  const path = `${framework === "svelte" ? ".." : "."}/${primitive}`;
  return content.replace(OUR_PACKAGES, `"${path}"`);
}

const PRIMITIVE_IMPORT = /(["'])@\/primitives\/([a-z-]+)\1/g;

/**
 * Any other file of the registry (a demo, a block) that imports a primitive
 * written in the registry, as `@/primitives/<name>`, imports it where
 * the primitive's adapter installs it: `$lib/components/audio-ui/<name>/<name>`
 * in Svelte, `@/components/audio-ui/<name>/<name>` elsewhere.
 */
export function rewritePrimitiveImports(content: string, svelte: boolean) {
  return content.replace(
    PRIMITIVE_IMPORT,
    (match, quote: string, name: string) =>
      SHIPPED_PRIMITIVES.has(name)
        ? `${quote}${svelte ? "$lib" : "@"}/components/audio-ui/${name}/${name}${quote}`
        : match
  );
}

/**
 * What the rest of the registry reads of the primitives: a few files with no
 * view in them, each shipped by an item of its own that the libs, the hooks
 * and the blocks import from, so none of them needs a package of ours. A
 * primitive ships the files it reads itself, beside its adapter, so it needs
 * no item. The first item to list a file is the one an import of it asks for.
 */
export const SHARED_ITEMS: Record<
  string,
  { description: string; files: string[]; uiSdk: boolean }
> = {
  grid: {
    description:
      "The grid a timeline snaps to, and the ranges it moves: nearest snap point, snapped moves, a range moved by one edge or whole.",
    files: ["grid.ts"],
    uiSdk: true,
  },
  primitive: {
    description:
      "What every audio/ui primitive shares: the parts named in kebab case, a value reported as a change and a commit, one pointer gesture at a time, sources and stores you push to.",
    files: ["primitive.ts"],
    uiSdk: true,
  },
  pitch: {
    description:
      "Note names and black keys from a MIDI pitch: C4 for 60, C# for the pitch class, whether a pitch is a black key.",
    files: ["pitch.ts"],
    uiSdk: false,
  },
  frame: {
    description:
      "A task that runs on animation frames only while it has something to animate, and a watch on whether an element is in view.",
    files: ["frame.ts"],
    uiSdk: false,
  },
  "piano-roll-edits": {
    description:
      "The notes of a piano roll and what edits them, with no view: move, resize, quantize, stretch, split, join, fit to a scale, humanize, delete and insert time, find, and the rows of a pitch range.",
    files: ["grid.ts", "piano-roll/edits.ts", "piano-roll/rows.ts"],
    uiSdk: true,
  },
  "timeline-clips": {
    description:
      "A clip on a timeline and what edits it, with no view: move, trim, split, duplicate, fade shapes and gain, copy and remove time, and the locators around a position.",
    files: ["grid.ts", "timeline/clip.ts", "timeline/locators.ts"],
    uiSdk: true,
  },
  "envelope-geometry": {
    description:
      "The points of a breakpoint envelope and how a segment between two of them bends, with no view: the level at a point, where a point is added, the polyline that draws it.",
    files: ["primitive.ts", "envelope/geometry.ts"],
    uiSdk: true,
  },
  "meter-levels": {
    description:
      "How a level in dB is placed along a meter (linear, IEC or VU), one reading of a meter, and the VU and PPM ballistics that give a needle its swing.",
    files: ["meter/levels.ts", "meter/ballistics.ts"],
    uiSdk: false,
  },
};

const INSTALLED_IMPORT = /from "@\/components\/audio-ui\/([a-z/-]+)"/g;

/** The shared item that installs a file of `base/primitives/`, if there is one. */
const sharedItemOf = (file: string) =>
  Object.entries(SHARED_ITEMS).find(([, item]) =>
    item.files.includes(file)
  )?.[0];

/**
 * The shared items a file needs: those that install what it imports, by the
 * path they land at, so an item never has to list them itself.
 */
export function sharedDependencies(content: string) {
  const needed = new Set<string>();
  for (const [, path] of content.matchAll(INSTALLED_IMPORT)) {
    const item = sharedItemOf(`${path}.ts`);
    if (item) {
      needed.add(item);
    }
  }
  return needed;
}

const REPEATED_IMPORT = /(["'])@\/components\/audio-ui\/([a-z-]+)\/\2\1/g;

/**
 * The shadcn CLI turns an import of `@/components/audio-ui/<name>/<name>` into
 * `@/components/audio-ui/<name>`, which for an element named as its primitive
 * (`plot.tsx` over `plot/plot.ts`) is the file itself. A file that imports a
 * primitive by that path imports it by a relative path instead, from where the
 * file installs, which the CLI leaves as it is.
 */
export function relativizeRepeatedImports(content: string, target: string) {
  const directory = dirname(target);
  return content.replace(
    REPEATED_IMPORT,
    (_match, quote: string, name: string) => {
      const path = relative(directory, `components/audio-ui/${name}/${name}`);
      return `${quote}${path.startsWith(".") ? path : `./${path}`}${quote}`;
    }
  );
}
