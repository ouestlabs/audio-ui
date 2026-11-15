import type { RegistryItem } from "shadcn/schema";
import { primitiveItems } from "../../items";

export const primitives: RegistryItem[] = [
  ...primitiveItems(
    "knob",
    [
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/react"],
        files: ["react.tsx"],
        name: "react",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/vue", "vue"],
        files: ["vue.ts"],
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
        files: ["web.ts"],
        name: "web",
      },
    ],
    "A rotary knob for one parameter: drag, wheel, keys, a log scale, a reset, and the change's source for an agent."
  ),
  ...primitiveItems(
    "fader",
    [
      { dependencies: ["@ui-sdk/react"], files: ["react.tsx"], name: "react" },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue.ts"],
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
      { dependencies: ["@ui-sdk/web"], files: ["web.ts"], name: "web" },
    ],
    "A linear fader for one parameter, vertical or horizontal: a press on the track, a drag of the thumb, wheel, keys, graduations, an anchor, and the change's source for an agent."
  ),
  ...primitiveItems(
    "xypad",
    [
      { dependencies: ["@ui-sdk/react"], files: ["react.tsx"], name: "react" },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue.ts"],
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
      { dependencies: ["@ui-sdk/web"], files: ["web.ts"], name: "web" },
    ],
    "A two-axis pad for two parameters at once: a press, a drag, wheel, keys and a native range input per axis, and the change's source for an agent."
  ),
  ...primitiveItems(
    "meter",
    [
      { dependencies: ["@ui-sdk/react"], files: ["react.tsx"], name: "react" },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: ["svelte/Value.svelte", "svelte/index.ts", "svelte/parts.ts"],
        name: "svelte",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/web"],
        files: ["web.ts"],
        name: "web",
      },
    ],
    "A level meter, vertical or horizontal, one channel or many: clip and warning levels with a held clip, peak marks, graduations, and a live source painted frame by frame with no render."
  ),
  ...primitiveItems(
    "envelope",
    [
      { dependencies: ["@ui-sdk/react"], files: ["react.tsx"], name: "react" },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue.ts"],
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
        files: ["web.ts"],
        name: "web",
      },
    ],
    "A breakpoint envelope editor, such as an ADSR shape or an automation curve: points to drag, add and remove, segments to bend, a grid to snap to, and the point's index in each change."
  ),
  ...primitiveItems(
    "pad",
    [
      { dependencies: ["@ui-sdk/react"], files: ["react.tsx"], name: "react" },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: ["svelte/index.ts", "svelte/parts.ts"],
        name: "svelte",
      },
      { dependencies: ["@ui-sdk/web"], files: ["web.ts"], name: "web" },
    ],
    "A grid of pads to strike, for drums and samples: each sounds while held, by pointer or keyboard, harder where it is pressed, with choke groups, several pointers at once, and the grid as one tab stop."
  ),
  ...primitiveItems(
    "piano",
    [
      { dependencies: ["@ui-sdk/react"], files: ["react.tsx"], name: "react" },
      {
        dependencies: ["@ui-sdk/vue", "vue"],
        files: ["vue.ts"],
        name: "vue",
      },
      {
        dependencies: ["@ui-sdk/svelte", "svelte"],
        files: ["svelte/Label.svelte", "svelte/index.ts", "svelte/parts.ts"],
        name: "svelte",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/web"],
        files: ["web.ts"],
        name: "web",
      },
    ],
    "A piano keyboard to play, laid out like a piano or evenly, horizontal or vertical: keys that sound while pressed, glide across, chords with several pointers, harder toward the free end, and the keyboard as one tab stop."
  ),
];
