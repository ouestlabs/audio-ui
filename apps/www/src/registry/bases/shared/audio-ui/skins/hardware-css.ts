/**
 * The Hardware skin as CSS: its token values on `.skin-hardware`, and its
 * materials as classes. Written once here: the registry item ships it as its
 * `css`, and `registry:build` writes `styles/skins/hardware.css` for this site.
 */

const SCREEN_INK = "oklch(0.9 0.02 90)";

/** What both modes share: the tokens that point at another one, and the lamp and level colors. */
const shared = {
  "--audio-screen-ink": SCREEN_INK,
  "--audio-readout": "var(--audio-screen)",
  "--audio-readout-ink": "var(--audio-screen-ink)",
  "--audio-level": SCREEN_INK,
  "--audio-warn": "oklch(0.78 0.15 75)",
  "--audio-clip": "oklch(0.6 0.22 27)",
};

export const HARDWARE_CSS = {
  ".skin-hardware": {
    "--audio-body": "oklch(0.91 0.006 90)",
    "--audio-screen": "oklch(0.19 0.008 250)",
    "--audio-socket": "oklch(0.8 0.006 90)",
    "--audio-cap": "oklch(0.96 0.004 90)",
    "--audio-groove": "oklch(0.28 0.006 90)",
    "--audio-print": "oklch(0.38 0.01 90)",
    "--audio-accent": "oklch(0.64 0.19 38)",
    ...shared,
  },
  ".dark .skin-hardware": {
    "--audio-body": "oklch(0.27 0.006 90)",
    "--audio-screen": "oklch(0.14 0.008 250)",
    "--audio-socket": "oklch(0.19 0.006 90)",
    "--audio-cap": "oklch(0.38 0.006 90)",
    "--audio-groove": "oklch(0.12 0 0)",
    "--audio-print": "oklch(0.78 0.01 90)",
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
  // A graph and an XY pad are screens set in the body.
  ".skin-hardware [data-slot=device-frame] :is([data-slot=plot], [data-slot=xypad] > [data-slot=xypad])":
    {
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
    },
  // Only the graph is sunk by a shadow: the pad draws its hover and focus rings with its own.
  ".skin-hardware [data-slot=device-frame] [data-slot=plot]": {
    "box-shadow": "inset 0 2px 6px rgb(0 0 0 / 0.55)",
    "border-radius": "6px",
  },
  // The pad is the inner one of its two slots. Its grid is drawn faint, so its lines start brighter.
  ".skin-hardware [data-slot=device-frame] [data-slot=xypad] > [data-slot=xypad]":
    {
      "--border":
        "color-mix(in oklab, var(--audio-screen-ink) 45%, var(--audio-screen))",
    },
  "@utility audio-body": {
    "background-color": "var(--audio-body)",
    color: "var(--audio-print)",
    "box-shadow": "inset 0 1px 0 rgb(255 255 255 / 0.35)",
  },
  "@utility audio-screen": {
    "background-color": "var(--audio-screen)",
    color: "var(--audio-screen-ink)",
    "box-shadow": "inset 0 2px 6px rgb(0 0 0 / 0.55)",
  },
  "@utility audio-cap": {
    "background-color": "var(--audio-cap)",
    "background-image":
      "linear-gradient(to bottom, rgb(255 255 255 / 0.18), rgb(0 0 0 / 0.08))",
    "box-shadow":
      "inset 0 1px 0 rgb(255 255 255 / 0.4), 0 2px 4px rgb(0 0 0 / 0.35)",
  },
  "@utility audio-groove": {
    "background-color": "var(--audio-groove)",
    "box-shadow": "inset 0 1px 2px rgb(0 0 0 / 0.6)",
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
