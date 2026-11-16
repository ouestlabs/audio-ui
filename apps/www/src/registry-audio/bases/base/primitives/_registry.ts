import type { RegistryItem } from "shadcn/schema";
import { primitiveItems } from "../../items";

export const primitives: RegistryItem[] = [
  ...primitiveItems(
    "knob",
    [
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Arc.svelte",
          "svelte/Indicator.svelte",
          "svelte/Provider.svelte",
          "svelte/Root.svelte",
          "svelte/Thumb.svelte",
          "svelte/Track.svelte",
          "svelte/Value.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/web"],
        files: ["web/index.ts"],
        name: "web",
      },
    ],
    "A rotary knob for one parameter: drag, wheel, keys, a log scale, a reset, and the change's source for an agent."
  ),
  ...primitiveItems(
    "fader",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Thumb.svelte",
          "svelte/Value.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      { dependencies: ["@ui-sdk/web"], files: ["web/index.ts"], name: "web" },
    ],
    "A linear fader for one parameter, vertical or horizontal: a press on the track, a drag of the thumb, wheel, keys, graduations, an anchor, and the change's source for an agent."
  ),
  ...primitiveItems(
    "xypad",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Thumb.svelte",
          "svelte/Value.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      { dependencies: ["@ui-sdk/web"], files: ["web/index.ts"], name: "web" },
    ],
    "A two-axis pad for two parameters at once: a press, a drag, wheel, keys and a native range input per axis, and the change's source for an agent."
  ),
  ...primitiveItems(
    "meter",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: ["svelte/Value.svelte", "svelte/index.ts", "svelte/parts.ts"],
        name: "svelte",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/web"],
        files: ["web/index.ts"],
        name: "web",
      },
    ],
    "A level meter, vertical or horizontal, one channel or many: clip and warning levels with a held clip, peak marks, graduations, and a live source painted frame by frame with no render."
  ),
  ...primitiveItems(
    "envelope",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Fill.svelte",
          "svelte/Line.svelte",
          "svelte/Polyline.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/web"],
        files: ["web/index.ts"],
        name: "web",
      },
    ],
    "A breakpoint envelope editor, such as an ADSR shape or an automation curve: points to drag, add and remove, segments to bend, a grid to snap to, and the point's index in each change."
  ),
  ...primitiveItems(
    "pad",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: ["svelte/index.ts", "svelte/parts.ts"],
        name: "svelte",
      },
      { dependencies: ["@ui-sdk/web"], files: ["web/index.ts"], name: "web" },
    ],
    "A grid of pads to strike, for drums and samples: each sounds while held, by pointer or keyboard, harder where it is pressed, with choke groups, several pointers at once, and the grid as one tab stop."
  ),
  ...primitiveItems(
    "piano",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: ["svelte/Label.svelte", "svelte/index.ts", "svelte/parts.ts"],
        name: "svelte",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/web"],
        files: ["web/index.ts"],
        name: "web",
      },
    ],
    "A piano keyboard to play, laid out like a piano or evenly, horizontal or vertical: keys that sound while pressed, glide across, chords with several pointers, harder toward the free end, and the keyboard as one tab stop."
  ),
  ...primitiveItems(
    "sequencer",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Cell.svelte",
          "svelte/Velocity.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      { dependencies: ["@ui-sdk/web"], files: ["web/index.ts"], name: "web" },
    ],
    "A step sequencer for a drum machine: a grid of steps to switch on and off, one row per sound, painted by dragging, with a velocity bar under each step and the step being played marked from a live clock."
  ),
  ...primitiveItems(
    "plot",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Band.svelte",
          "svelte/Curve.svelte",
          "svelte/Grid.svelte",
          "svelte/GridLines.svelte",
          "svelte/Handle.svelte",
          "svelte/Line.svelte",
          "svelte/Path.svelte",
          "svelte/Trace.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      { dependencies: ["@ui-sdk/web"], files: ["web/index.ts"], name: "web" },
    ],
    "A plot of values over two axes: curves, live traces, lines, bands, a grid with its labels, dots and draggable handles with a native input each, and a cursor that reads the value under the pointer."
  ),
  ...primitiveItems(
    "waveform",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Bars.svelte",
          "svelte/Control.svelte",
          "svelte/RegionHandle.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      { dependencies: ["@ui-sdk/web"], files: ["web/index.ts"], name: "web" },
    ],
    "A waveform of audio: bars or a canvas drawn from peaks or a live signal, a seekable control with a native input, a playhead and thumb that follow a live position, a hover readout, markers, and named regions with draggable edges."
  ),
  ...primitiveItems(
    "timeline",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Clip.svelte",
          "svelte/ClipFade.svelte",
          "svelte/ClipFadeHandle.svelte",
          "svelte/ClipHandle.svelte",
          "svelte/Mark.svelte",
          "svelte/NavigatorHandle.svelte",
          "svelte/NavigatorWindow.svelte",
          "svelte/Range.svelte",
          "svelte/RangeHandle.svelte",
          "svelte/Ruler.svelte",
          "svelte/TrackResizeHandle.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/web"],
        files: ["web/index.ts"],
        name: "web",
      },
    ],
    "An arrangement timeline: a position and a zoom, a viewport that scrolls and zooms around the pointer, a ruler, a navigator, tracks with resizable heights, lanes, marks, ranges such as loops, and clips that move, trim and fade, each with a native input for the keyboard."
  ),
  ...primitiveItems(
    "piano-roll",
    [
      {
        dependencies: ["@ui-sdk/react"],
        files: ["react/index.tsx"],
        name: "react",
      },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue/index.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Note.svelte",
          "svelte/NoteHandle.svelte",
          "svelte/Notes.svelte",
          "svelte/Rows.svelte",
          "svelte/StretchHandle.svelte",
          "svelte/Velocity.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      { dependencies: ["@ui-sdk/web"], files: ["web/index.ts"], name: "web" },
    ],
    "A piano roll for editing MIDI notes: a grid you draw, move, resize and select notes on, with rows by pitch and scale, velocity or chance bars, a marquee, and a native input on each bar for the keyboard. It sits on a timeline's duration, grid, zoom and playback position, which you give it."
  ),
  {
    categories: ["primitive", "css"],
    description:
      "The anatomy of the knob and the fader, drawn: flat, square, one thin stroke. Optional, and the same for every framework. It reads the tokens of the UI SDK stylesheet when the page has it.",
    files: [
      {
        path: "primitives/audio-ui.css",
        target: "~/src/audio-ui-primitives.css",
        type: "registry:file",
      },
    ],
    name: "primitives-css",
    type: "registry:file",
  },
];
