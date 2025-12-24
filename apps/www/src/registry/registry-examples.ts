import type { Registry } from "shadcn/schema";

export const examples: Registry["items"] = [
  {
    name: "player-demo",
    description: "Audio player demo",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [{ path: "examples/player-demo.tsx", type: "registry:example" }],
    categories: ["player"],
  },

  {
    name: "player-queue-demo",
    description: "Audio player with queue demo",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/queue"],
    files: [
      {
        path: "examples/player-queue-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["player", "queue"],
  },
  {
    name: "player-stacked-demo",
    description: "Audio player with stacked layout",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "examples/player-stacked-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["player"],
  },
  {
    name: "queue-shuffle-repeat-demo",
    description: "Minimal queue with shuffle and repeat controls",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/queue"],
    files: [
      {
        path: "examples/queue-shuffle-repeat-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["queue"],
  },
  {
    name: "queue-preferences-demo",
    description: "Minimal queue with preferences dropdown",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/queue"],
    files: [
      {
        path: "examples/queue-preferences-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["queue"],
  },
  {
    name: "queue-all-controls-demo",
    description: "Queue with all controls (shuffle, repeat, preferences)",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/queue"],
    files: [
      {
        path: "examples/queue-all-controls-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["queue"],
  },
  {
    name: "track-demo",
    description: "Minimal track component example",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/track"],
    files: [
      {
        path: "examples/track-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track"],
  },
  {
    name: "track-list-demo",
    description: "Track list with selection example",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/track"],
    files: [
      {
        path: "examples/track-list-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track"],
  },
  {
    name: "track-list-grid-demo",
    description: "Track list with grid layout example",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/track"],
    files: [
      {
        path: "examples/track-list-grid-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track", "grid"],
  },
  {
    name: "track-sortable-list-demo",
    description: "Track list with sortable selection example",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/track"],
    files: [
      {
        path: "examples/track-sortable-list-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track", "sortable"],
  },
  {
    name: "track-sortable-list-grid-demo",
    description: "Track list with sortable selection and grid layout example",
    type: "registry:example",
    registryDependencies: ["@audio/player", "@audio/track"],
    files: [
      {
        path: "examples/track-sortable-list-grid-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track", "sortable", "grid"],
  },
  {
    name: "slider-demo",
    description: "Slider component examples",
    type: "registry:example",
    registryDependencies: ["@audio/slider"],
    files: [
      {
        path: "examples/slider-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["slider", "ui"],
  },
  {
    name: "sortable-list-demo",
    description: "Sortable list component examples",
    type: "registry:example",
    registryDependencies: ["@audio/sortable-list"],
    files: [
      {
        path: "examples/sortable-list-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["sortable-list", "ui"],
  },
  {
    name: "playback-speed-demo",
    description: "Playback speed component example",
    type: "registry:example",
    registryDependencies: ["@audio/playback-speed", "@audio/player"],
    files: [
      {
        path: "examples/playback-speed-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["playback-speed"],
  },

  {
    name: "fader-demo",
    description: "Fader component example",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "examples/fader-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["fader"],
  },
  {
    name: "fader-horizontal-demo",
    description: "Fader component example with horizontal orientation",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "examples/fader-horizontal-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["fader"],
  },

  {
    name: "fader-no-thumb-marks-demo",
    description: "Fader component example with no thumb marks",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "examples/fader-no-thumb-marks-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["fader"],
  },
  {
    name: "fader-custom-thumb-marks-demo",
    description: "Fader component example with custom thumb marks",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "examples/fader-custom-thumb-marks-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["fader"],
  },
  {
    name: "fader-multiple-control-demo",
    description: "Fader component example with multiple controls",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "examples/fader-multiple-control-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["fader"],
  },
  {
    name: "fader-volume-control-demo",
    description: "Fader component example with volume control",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "examples/fader-volume-control-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["fader"],
  },
  {
    name: "knob-demo",
    description: "Knob component example",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "examples/knob-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-size-variants-demo",
    description: "Knob component example with size variants",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "examples/knob-size-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-filter-control-demo",
    description: "Knob component example with filter control",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "examples/knob-filter-control-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-multiple-control-demo",
    description: "Knob component example with multiple controls",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "examples/knob-multiple-control-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "xypad-demo",
    description: "XYPad component example",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "examples/xypad-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-format-value-demo",
    description: "XYPad component example with formatted value",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "examples/xypad-format-value-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-hide-value-demo",
    description: "XYPad component example with hidden value",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "examples/xypad-hide-value-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-filter-control-demo",
    description: "XYPad component example with filter control",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "examples/xypad-filter-control-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-synthesizer-control-demo",
    description: "XYPad component example with synthesizer control",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "examples/xypad-synthesizer-control-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
];
