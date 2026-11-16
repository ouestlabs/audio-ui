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
export const SHIPPED_PRIMITIVES = new Set(["fader", "knob"]);

/** The files of a primitive, by path from `base/primitives/`. */
export const primitiveFiles = (name: string) => [
  "primitive.ts",
  `${name}/${name}.ts`,
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
