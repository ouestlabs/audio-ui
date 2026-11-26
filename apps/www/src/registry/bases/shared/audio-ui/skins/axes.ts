/**
 * What every skin derives its tokens from: a few axes, set on the skin's own
 * element. `--audio-shade` is the material and everything else follows from
 * it; a dark one (lightness under 0.5) turns the skin dark.
 */

/** 1 on a dark shade, 0 on a light one: read inside a color made `from` the shade, where `l` is its lightness. */
const DARK = "clamp(0, (0.5 - l) * 1000, 1)";

/** A tone of the shade: its lightness moved by `light` on a light shade and by `light + dark` on a dark one. */
export const tone = (light: number, dark = 0, chroma = "c") =>
  `oklch(from var(--audio-shade) calc(l + ${light} + ${dark} * ${DARK}) ${chroma} h)`;

/** A tone at a fixed lightness, `light` on a light shade and `light + dark` on a dark one, in the shade's hue. */
export const level = (light: number, dark: number, chroma = "c", hue = "h") =>
  `oklch(from var(--audio-shade) calc(${light} + ${dark} * ${DARK}) ${chroma} ${hue})`;

/** A length that scales with `--audio-depth`. */
export const deep = (px: number) => `calc(${px}px * var(--audio-depth))`;

/** An opacity that scales with `--audio-depth`. */
export const strength = (alpha: number) =>
  `calc(${alpha} * var(--audio-depth))`;

/** A corner that scales with `--audio-roundness`. */
export const corner = (px: number) => `calc(${px}px * var(--audio-roundness))`;

/** The axes a skin starts from. `--audio-ink` has none: a skin reads it with its own lettering as the fallback. */
export const AXES = {
  "--audio-depth": "1",
  "--audio-roundness": "1",
};

/**
 * The materials, as classes: shared by every skin, each drawn with the light
 * the skin gives it (`--audio-cap-shadow`, `--audio-groove-shadow`…).
 */
export const MATERIALS_CSS = {
  "@utility audio-body": {
    "background-color": "var(--audio-body)",
    color: "var(--audio-print)",
    "box-shadow": "var(--audio-body-shadow, none)",
  },
  "@utility audio-screen": {
    "background-color": "var(--audio-screen)",
    color: "var(--audio-screen-ink)",
    "box-shadow": "var(--audio-screen-shadow, none)",
  },
  "@utility audio-cap": {
    "background-color": "var(--audio-cap)",
    "background-image": "var(--audio-cap-image, none)",
    "box-shadow": "var(--audio-cap-shadow, none)",
  },
  "@utility audio-groove": {
    "background-color": "var(--audio-groove)",
    "box-shadow": "var(--audio-groove-shadow, none)",
  },
  "@utility audio-print": {
    color: "var(--audio-print)",
    "font-size": "9px",
    "line-height": "1",
    "letter-spacing": "0.04em",
    "text-transform": "uppercase",
    "font-variant-numeric": "tabular-nums",
  },
  "@utility audio-lamp": {
    "border-radius": "9999px",
    "background-color":
      "color-mix(in oklab, var(--audio-clip) 25%, var(--audio-screen))",
  },
  "@utility audio-lamp-on": {
    "background-color": "var(--audio-clip)",
    "box-shadow": "0 0 6px var(--audio-clip)",
  },
};
