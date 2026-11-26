import { AXES, corner, level, MATERIALS_CSS, strength, tone } from "./axes.ts";

/**
 * The Hardware skin as CSS: its axes and the tokens it derives from them on
 * `.skin-hardware`, and the light of its materials. Written once here: the
 * registry item ships it as its `css`, and `registry:build` writes
 * `styles/skins/hardware.css` for this site.
 */

const SCREEN_INK = "oklch(0.9 0.02 90)";

/** A screen set in the body: the theme's colors read the screen's, so a part drawn from them changes with no rule of its own. */
const SCREEN = {
  "--background": "var(--audio-screen)",
  "--card": "var(--audio-screen)",
  "--popover": "var(--audio-screen)",
  "--foreground": "var(--audio-screen-ink)",
  "--popover-foreground": "var(--audio-screen-ink)",
  "--muted-foreground":
    "color-mix(in oklab, var(--audio-screen-ink) 65%, var(--audio-screen))",
  "--muted":
    "color-mix(in oklab, var(--audio-screen-ink) 8%, var(--audio-screen))",
  // Its grid is drawn faint, so its lines start brighter.
  "--border":
    "color-mix(in oklab, var(--audio-screen-ink) 45%, var(--audio-screen))",
  "--primary": "var(--audio-accent)",
  "--primary-foreground": "var(--audio-screen)",
  "--ring": "var(--audio-accent)",
  // Sunk in the body: its shadow joins the ring the part draws its hover and focus with.
  "--tw-shadow": "var(--audio-screen-shadow)",
  "border-color": "transparent",
};

/** A cap's light, and the ring its focus draws on top of it. */
const CAP = "var(--audio-cap-shadow)";
const FOCUS = `${CAP}, 0 0 0 3px color-mix(in oklab, var(--audio-accent) 50%, transparent)`;

/** The printed scale of a knob given no marks: eleven ticks along its sweep, from 225° round to 135°, none in the gap below. */
const PRINTED_SCALE = {
  content: '""',
  position: "absolute",
  inset: "-0.5rem",
  "border-radius": "9999px",
  "pointer-events": "none",
  background:
    "repeating-conic-gradient(from 224deg, var(--audio-print) 0deg 2deg, transparent 2deg 27deg)",
  mask: "radial-gradient(farthest-side, transparent calc(100% - 0.3rem), #000 calc(100% - 0.25rem)), conic-gradient(from 136deg, transparent 0deg 88deg, #000 0deg)",
  "mask-composite": "intersect",
};

export const HARDWARE_CSS = {
  ".skin-hardware": {
    ...AXES,
    "--audio-shade": "oklch(0.91 0.006 90)",
    "--audio-accent": "oklch(0.64 0.19 38)",
    "--audio-body": "var(--audio-shade)",
    "--audio-socket": tone(-0.11, 0.03),
    "--audio-cap": tone(0.05, 0.06),
    "--audio-groove": level(0.28, -0.16),
    "--audio-print": `var(--audio-ink, ${level(0.38, 0.4, "calc(c + 0.004)")})`,
    "--audio-screen": level(0.19, -0.05, "0.008", "250"),
    "--audio-screen-ink": SCREEN_INK,
    "--audio-readout": "var(--audio-screen)",
    "--audio-readout-ink": "var(--audio-screen-ink)",
    "--audio-level": SCREEN_INK,
    "--audio-warn": "oklch(0.78 0.15 75)",
    "--audio-clip": "oklch(0.6 0.22 27)",
    "--audio-body-shadow": `inset 0 1px 0 rgb(255 255 255 / ${strength(0.35)})`,
    "--audio-screen-shadow": `inset 0 2px 6px rgb(0 0 0 / ${strength(0.55)})`,
    "--audio-cap-image": `linear-gradient(to bottom, rgb(255 255 255 / ${strength(0.18)}), rgb(0 0 0 / ${strength(0.08)}))`,
    "--audio-cap-shadow": `inset 0 1px 0 rgb(255 255 255 / ${strength(0.4)}), 0 2px 4px rgb(0 0 0 / ${strength(0.35)})`,
    "--audio-groove-shadow": `inset 0 1px 2px rgb(0 0 0 / ${strength(0.6)})`,
  },
  // In the dark, the same skin on a darker shade: every token follows from it.
  ".dark .skin-hardware": {
    "--audio-shade": "oklch(0.27 0.006 90)",
    "--audio-accent": "oklch(0.7 0.17 42)",
  },
  // A device panel wears the skin from its frame: the theme's own colors read the skin's, so no panel changes.
  ".skin-hardware [data-slot=device-frame]": {
    "--card": "var(--audio-body)",
    "--card-foreground": "var(--audio-print)",
    "--foreground": "var(--audio-print)",
    "--muted-foreground": "var(--audio-print)",
    // What a pressed button is filled with: toward the lettering, so it shows on a light body and a dark one.
    "--muted": "color-mix(in oklab, var(--audio-print) 18%, var(--audio-body))",
    "--border":
      "color-mix(in oklab, var(--audio-print) 22%, var(--audio-body))",
    "--input": "color-mix(in oklab, var(--audio-print) 28%, var(--audio-body))",
    "--primary": "var(--audio-accent)",
    "--primary-foreground": "oklch(0.15 0.01 40)",
    "--ring": "var(--audio-accent)",
    color: "var(--audio-print)",
  },
  // A device's graph is a screen set in the body.
  ".skin-hardware [data-slot=device-frame] [data-slot=plot]": {
    "--background": "var(--audio-screen)",
    "--card": "var(--audio-screen)",
    "--foreground": "var(--audio-screen-ink)",
    "--muted-foreground":
      "color-mix(in oklab, var(--audio-screen-ink) 65%, var(--audio-screen))",
    "--muted":
      "color-mix(in oklab, var(--audio-screen-ink) 8%, var(--audio-screen))",
    "--border":
      "color-mix(in oklab, var(--audio-screen-ink) 18%, var(--audio-screen))",
    "background-color": "var(--audio-screen)",
    color: "var(--audio-screen-ink)",
    "box-shadow": "var(--audio-screen-shadow)",
    "border-radius": corner(6),
  },
  // The knob: a matte cap lit from above in a dark socket, a needle in the lettering's color, its arc in the accent.
  ".skin-hardware [data-slot=knob-control]": {
    "--tw-shadow": `inset 0 1px 3px rgb(0 0 0 / ${strength(0.5)})`,
  },
  ".skin-hardware [data-slot=knob-body]": {
    inset: "12%",
    "background-image": "var(--audio-cap-image)",
    "box-shadow": CAP,
  },
  ".skin-hardware [data-slot=knob-track]": { opacity: "0" },
  ".skin-hardware [data-slot=knob-needle]": { color: "var(--audio-print)" },
  ".skin-hardware [data-slot=knob]:not([data-marks])::before": PRINTED_SCALE,
  // A graduation the value has passed is lit, its label with its tick: the readout's color is its screen's, dark on the body.
  ".skin-hardware :is([data-slot=knob-mark], [data-slot=fader-mark])[data-active] :is([data-slot=knob-mark-label], [data-slot=fader-mark-label])":
    { color: "var(--audio-accent)" },
  // The fader: a narrow slot and a ribbed cap, its middle rib in the accent. The slot shows no range.
  ".skin-hardware [data-slot=fader-track][data-orientation=vertical]": {
    width: "0.25rem",
    "box-shadow": "var(--audio-groove-shadow)",
  },
  ".skin-hardware [data-slot=fader-track][data-orientation=horizontal]": {
    height: "0.25rem",
    "box-shadow": "var(--audio-groove-shadow)",
  },
  ".skin-hardware [data-slot=fader-indicator]": { opacity: "0" },
  ".skin-hardware [data-slot=fader-thumb]": {
    "border-color": "transparent",
    "border-radius": corner(3),
    "background-image": "var(--audio-cap-image)",
    "box-shadow": CAP,
  },
  ".skin-hardware [data-slot=fader-thumb]:has(:focus-visible)": {
    "box-shadow": FOCUS,
  },
  ".skin-hardware [data-slot=fader-thumb-mark]": {
    "background-color":
      "color-mix(in oklab, var(--audio-print) 45%, transparent)",
    opacity: "1",
  },
  ".skin-hardware :is([data-slot=fader-thumb-mark]:nth-child(2):nth-last-child(2), [data-slot=fader-thumb-mark]:nth-child(3):nth-last-child(3))":
    { "background-color": "var(--audio-accent)" },
  // The meter: its level lit in segments, as a row of lamps.
  ".skin-hardware [data-slot=meter-channel][data-orientation=vertical] [data-slot=meter-indicator]":
    {
      mask: "repeating-linear-gradient(to top, #000 0 3px, transparent 3px 4px)",
    },
  ".skin-hardware [data-slot=meter-channel][data-orientation=horizontal] [data-slot=meter-indicator]":
    {
      mask: "repeating-linear-gradient(to right, #000 0 3px, transparent 3px 4px)",
    },
  // The XY pad, the envelope, the plot and the waveform are screens set in the body.
  ".skin-hardware :is([data-slot=xypad-control], [data-slot=envelope-frame], [data-slot=plot], [data-slot=waveform-control])":
    SCREEN,
  // The waveform draws no surface of its own: in the body, it is a screen too.
  ".skin-hardware [data-slot=waveform-control]": {
    "background-color": "var(--audio-screen)",
    "border-radius": corner(6),
  },
  // A pad is a cap to strike: lit from above, flashing in the accent.
  ".skin-hardware [data-slot=pad-item]": {
    "--muted": "var(--audio-cap)",
    "--muted-foreground": "var(--audio-print)",
    "--primary": "var(--audio-accent)",
    "--primary-foreground": "oklch(0.15 0.01 40)",
    "--border":
      "color-mix(in oklab, var(--audio-print) 22%, var(--audio-body))",
    "--ring": "var(--audio-accent)",
    "background-image": "var(--audio-cap-image)",
    "box-shadow": CAP,
  },
  ".skin-hardware [data-slot=pad-item]:focus-visible": { "box-shadow": FOCUS },
  // The keyboard: ivory and ebony keys in the body, held in the accent.
  ".skin-hardware [data-slot=piano]": {
    "--piano-key-white": "oklch(0.95 0.012 85)",
    "--piano-key-black": "oklch(0.2 0.006 90)",
    "--card": "var(--audio-body)",
    "--primary": "var(--audio-accent)",
    "--ring": "var(--audio-accent)",
    "--tw-shadow": "var(--audio-screen-shadow)",
  },
  ...MATERIALS_CSS,
};
