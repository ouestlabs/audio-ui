import {
  AXES,
  corner,
  deep,
  level,
  MATERIALS_CSS,
  strength,
  tone,
} from "./axes.ts";

/**
 * The Neu skin as CSS: one material lit from above, every control the surface
 * itself pushed up or pressed in. It draws the elements as they are, from
 * their parts, so it has no faces of its own. Written once here: the registry
 * item ships it as its `css`, and `registry:build` writes
 * `styles/skins/neu.css` for this site.
 */

/** The material screened with itself: its light, weaker on a dark shade. */
const light = (alpha: number) =>
  `oklch(from var(--audio-shade) calc(l + (1 - l) * 0.75) calc(c * 0.6) h / calc(${strength(alpha)} * (1 - 0.8 * clamp(0, (0.5 - l) * 1000, 1))))`;

/** The material multiplied by itself: its shadow, which keeps its hue. */
const shadow = (alpha: number) =>
  `oklch(from var(--audio-shade) calc(l * 0.63) calc(c * 1.5) h / ${strength(alpha)})`;

/** A part pushed up out of the surface: lit on its top edge, casting below. */
const RAISED = `0 ${deep(-2)} ${deep(4)} ${light(0.9)}, 0 ${deep(3)} ${deep(7)} ${shadow(0.5)}`;
/** A part pressed into the surface: shaded under its lit lip, caught by the light on its far wall. */
const SUNKEN = `inset 0 ${deep(2)} ${deep(4)} ${shadow(0.45)}, inset 0 ${deep(-1)} ${deep(2)} ${light(0.8)}`;
/** The face of a raised part, lighter toward the light. */
const FACE = `linear-gradient(to bottom, ${light(0.45)}, ${shadow(0.08)})`;

const INK = level(0.42, 0.42, "calc(c + 0.01)");

/** A well pressed into the surface: the theme's colors read the material's, so a part drawn from them changes with no rule of its own. */
const WELL = {
  "--background": "var(--audio-shade)",
  "--card": "var(--audio-shade)",
  "--popover": "var(--audio-cap)",
  "--foreground": "var(--audio-print)",
  "--popover-foreground": "var(--audio-print)",
  "--muted-foreground":
    "color-mix(in oklab, var(--audio-print) 75%, var(--audio-body))",
  "--border": "color-mix(in oklab, var(--audio-print) 18%, var(--audio-body))",
  "--primary": "var(--audio-accent)",
  "--primary-foreground": "var(--audio-body)",
  "--ring": "var(--audio-accent)",
  // Its shadow joins the ring the part draws its hover and focus with.
  "--tw-shadow": SUNKEN,
  "border-color": "transparent",
};

/** A raised part's light, and the ring its focus draws on top of it. */
const FOCUS = `${RAISED}, 0 0 0 3px color-mix(in oklab, var(--audio-accent) 50%, transparent)`;

export const NEU_CSS = {
  ".skin-neu": {
    ...AXES,
    "--audio-shade": "oklch(0.92 0.004 250)",
    "--audio-accent": "oklch(0.6 0.17 255)",
    "--audio-body": "var(--audio-shade)",
    "--audio-socket": "var(--audio-shade)",
    "--audio-cap": tone(0.01, 0.02),
    "--audio-groove": tone(-0.04, -0.03),
    "--audio-print": `var(--audio-ink, ${INK})`,
    "--audio-screen": tone(-0.03, -0.03),
    "--audio-screen-ink": "var(--audio-print)",
    "--audio-readout": "var(--audio-print)",
    "--audio-readout-ink": "var(--audio-body)",
    "--audio-level": "var(--audio-accent)",
    "--audio-warn": "oklch(0.75 0.15 75)",
    "--audio-clip": "oklch(0.62 0.21 27)",
    "--audio-body-shadow": RAISED,
    "--audio-screen-shadow": SUNKEN,
    "--audio-cap-image": FACE,
    "--audio-cap-shadow": RAISED,
    "--audio-groove-shadow": SUNKEN,
  },
  // In the dark, the same material on a darker shade: every token follows from it.
  ".dark .skin-neu": {
    "--audio-shade": "oklch(0.3 0.006 250)",
    "--audio-accent": "oklch(0.68 0.15 255)",
  },
  // A knob is a dome pushed out of the surface. Its shadow joins the ring's, which keeps its focus and hover.
  ".skin-neu [data-slot=knob]": {
    "--tw-shadow": RAISED,
  },
  ".skin-neu [data-slot=knob-control]": {
    "background-image": FACE,
  },
  ".skin-neu :is([data-slot=fader-track], [data-slot=meter-channel])": {
    "box-shadow": SUNKEN,
  },
  // A fader's cap is raised out of its groove, with no outline of its own.
  ".skin-neu [data-slot=fader-thumb]": {
    "--tw-shadow": RAISED,
    "border-color": "transparent",
    "background-image": FACE,
  },
  // The XY pad and the envelope are wells pressed into the surface.
  ".skin-neu :is([data-slot=xypad-control], [data-slot=envelope-frame])": WELL,
  // A pad is pushed up out of the surface, and pressed into it while struck.
  ".skin-neu [data-slot=pad-item]": {
    "--muted": "var(--audio-shade)",
    "--muted-foreground": "var(--audio-print)",
    "--primary": "var(--audio-accent)",
    "--primary-foreground": "var(--audio-body)",
    "--ring": "var(--audio-accent)",
    "border-color": "transparent",
    "background-image": FACE,
    "box-shadow": RAISED,
  },
  ".skin-neu [data-slot=pad-item]:focus-visible": { "box-shadow": FOCUS },
  ".skin-neu [data-slot=pad-item][data-active]": {
    "background-image": "none",
    "box-shadow": SUNKEN,
  },
  // The keyboard is a well of keys of the material: lighter for the white ones, deep for the black.
  ".skin-neu [data-slot=piano]": {
    "--piano-key-white": tone(0.05, 0.04),
    "--piano-key-black": "oklch(from var(--audio-shade) calc(l * 0.4) c h)",
    "--card": "var(--audio-shade)",
    "--primary": "var(--audio-accent)",
    "--ring": "var(--audio-accent)",
    "--tw-shadow": SUNKEN,
    "border-color": "transparent",
  },
  // A device panel is a plate of the material: the theme's own colors read the skin's, so no panel changes.
  ".skin-neu [data-slot=device-frame]": {
    "--card": "var(--audio-body)",
    "--card-foreground": "var(--audio-print)",
    "--foreground": "var(--audio-print)",
    "--muted-foreground":
      "color-mix(in oklab, var(--audio-print) 75%, var(--audio-body))",
    "--muted": "var(--audio-groove)",
    "--border":
      "color-mix(in oklab, var(--audio-print) 14%, var(--audio-body))",
    "--input": "color-mix(in oklab, var(--audio-print) 20%, var(--audio-body))",
    "--primary": "var(--audio-accent)",
    "--primary-foreground": "var(--audio-body)",
    "--ring": "var(--audio-accent)",
    "background-color": "var(--audio-body)",
    "border-color": "transparent",
    "box-shadow": RAISED,
    color: "var(--audio-print)",
  },
  // A device's graph is a well pressed into the plate.
  ".skin-neu [data-slot=device-frame] [data-slot=plot]": {
    "--background": "var(--audio-screen)",
    "--card": "var(--audio-screen)",
    "background-color": "var(--audio-screen)",
    "border-color": "transparent",
    "box-shadow": SUNKEN,
    "border-radius": corner(8),
  },
  ...MATERIALS_CSS,
};
