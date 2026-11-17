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

const OUR_PACKAGES = /["']@audio-ui\/(?:core|primitives)\/[^"']*["']/g;

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
  "piano-roll": [
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

const PRIMITIVE_IMPORT = /(["'])@audio-ui\/primitives\/([a-z-]+)\1/g;

/**
 * Any other file of the registry (a demo, a block) that imports a primitive
 * written in the registry, as `@audio-ui/primitives/<name>`, imports it where
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
