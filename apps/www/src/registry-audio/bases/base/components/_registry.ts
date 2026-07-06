import type { RegistryItem } from "shadcn/schema";

export const components: RegistryItem[] = [
  {
    name: "block-pocket-synth",
    description: "Pocket synth with oscillator, filter, and XY pad",
    type: "registry:block",
    registryDependencies: [
      "@audio/use-audio",
      "@audio/fader",
      "@audio/xypad",
      "@shadcn/toggle-group",
    ],
    files: [
      {
        path: "components/synth/block-pocket-synth.tsx",
        type: "registry:block",
      },
    ],
    categories: ["synth", "xypad"],
  },
  {
    name: "block-wave-shaper",
    description: "Wave shaper synth with distortion, tone, and detune controls",
    type: "registry:block",
    registryDependencies: [
      "@audio/use-audio",
      "@audio/fader",
      "@audio/xypad",
      "@audio/knob",
      "@shadcn/toggle-group",
    ],
    files: [
      {
        path: "components/synth/block-wave-shaper.tsx",
        type: "registry:block",
      },
    ],
    categories: ["synth", "xypad"],
  },
  {
    name: "block-player",
    description: "Audio player",
    type: "registry:block",
    registryDependencies: ["@audio/player", "@audio/store", "@audio/html"],
    files: [
      {
        path: "components/player/block-player.tsx",
        type: "registry:block",
      },
    ],
    categories: ["player", "queue"],
  },
  {
    name: "block-player-widget",
    description: "Audio player with track list",
    type: "registry:block",
    registryDependencies: ["@audio/player", "@audio/store", "@audio/html"],
    files: [
      {
        path: "components/player/block-player-widget.tsx",
        type: "registry:block",
      },
    ],
    categories: ["player", "widget"],
  },
  {
    name: "block-queue",
    description: "Queue controls",
    type: "registry:block",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/queue/block-queue.tsx",
        type: "registry:block",
      },
    ],
    categories: ["queue", "ui"],
  },
  {
    name: "block-channel-strip-transport-vertical",
    description:
      "Channel strip with transport seek bar in vertical orientation",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/transport"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-transport-vertical.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "transport"],
  },
  {
    name: "block-channel-strip-transport",
    description:
      "Channel strip with transport seek bar in horizontal orientation",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/transport"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-transport.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "transport"],
  },
  {
    name: "block-channel-strip",
    description: "Channel strip with fader, header, and footer",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "fader", "ui"],
  },
  {
    name: "block-channel-strip-horizontal",
    description: "Channel strip with fader in horizontal orientation",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-horizontal.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "fader", "ui"],
  },
  {
    name: "block-channel-strip-fader",
    description: "Channel strip with a minimal fader section",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "fader", "ui"],
  },
  {
    name: "block-channel-strip-fader-gain-db",
    description: "Channel strip with bipolar gain fader (-60 dB to +6 dB)",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-gain-db.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "fader", "ui"],
  },
  {
    name: "block-channel-strip-fader-multi",
    description: "Multiple fader channel strips in a row",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-multi.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "fader"],
  },
  {
    name: "block-channel-strip-knob-multi",
    description: "Multiple knob channel strips in a row",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-multi.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "knob"],
  },
  {
    name: "block-channel-strip-fader-horizontal",
    description:
      "Channel strip with a minimal fader section in horizontal orientation",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-horizontal.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "fader", "ui"],
  },
  {
    name: "block-channel-strip-fader-slider",
    description: "Channel strip with horizontal fader and inline label",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-slider.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "fader", "ui"],
  },
  {
    name: "block-channel-strip-knob-level",
    description: "Channel strip with a level knob",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-level.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "knob", "ui"],
  },
  {
    name: "block-channel-strip-knob-macro",
    description: "Channel strip with an oversized macro knob",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-macro.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "knob", "ui"],
  },
  {
    name: "block-channel-strip-knob-pan",
    description: "Channel strip with a bipolar pan knob",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-pan.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "knob", "ui"],
  },
  {
    name: "block-channel-strip-knob-pan-width",
    description: "Channel strip with pan and width knobs in a row",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-pan-width.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "knob", "ui"],
  },
  {
    name: "block-channel-strip-xypad-filter",
    description: "Channel strip with an XY filter pad",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/xypad"],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-xypad-filter.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "xypad", "ui"],
  },
  {
    name: "block-channel-strip-xypad-reverb",
    description: "Channel strip with XY spatial pad and wet knob",
    type: "registry:block",
    registryDependencies: [
      "@audio/channel-strip",
      "@audio/xypad",
      "@audio/knob",
    ],
    files: [
      {
        path: "components/channel-strip/block-channel-strip-xypad-reverb.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "xypad", "ui"],
  },
  {
    name: "player-demo",
    description: "Audio player demo",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/player/player-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["player"],
  },
  {
    name: "player-queue-demo",
    description: "Audio player with queue demo",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/player/player-queue-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["player", "queue"],
  },
  {
    name: "player-variant-demo",
    description: "AudioPlayer variant options (default, outline, ghost)",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/player/player-variant-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["player"],
  },
  {
    name: "player-size-demo",
    description: "AudioPlayer size options (sm, default, lg)",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/player/player-size-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["player"],
  },
  {
    name: "player-stacked-demo",
    description: "Audio player with stacked layout",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/player/player-stacked-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["player"],
  },
  {
    name: "player-queue-shuffle-repeat-demo",
    description: "Minimal queue with shuffle and repeat controls",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/queue/player-queue-shuffle-repeat-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["queue"],
  },
  {
    name: "player-queue-preferences-demo",
    description: "Minimal queue with preferences dropdown",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/queue/player-queue-preferences-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["queue"],
  },
  {
    name: "player-queue-simple-demo",
    description: "Stacked player with queue and preferences",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/queue/player-queue-simple-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["queue"],
  },
  {
    name: "player-queue-all-controls-demo",
    description: "Queue with all controls (shuffle, repeat, preferences)",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/queue/player-queue-all-controls-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["queue"],
  },
  {
    name: "player-track-demo",
    description: "Minimal track component example",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/track/player-track-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track"],
  },
  {
    name: "player-track-list-demo",
    description: "Track list with selection example",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/track/player-track-list-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track"],
  },
  {
    name: "player-track-list-grid-demo",
    description: "Track list with grid layout example",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/track/player-track-list-grid-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track", "grid"],
  },
  {
    name: "player-track-sortable-list-demo",
    description: "Track list with sortable selection example",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/track/player-track-sortable-list-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track", "sortable"],
  },
  {
    name: "player-track-sortable-list-grid-demo",
    description: "Track list with sortable selection and grid layout example",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/track/player-track-sortable-list-grid-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["track", "sortable", "grid"],
  },
  {
    name: "transport-demo",
    description: "Transport timeline with buffered range example",
    type: "registry:example",
    registryDependencies: ["@audio/transport"],
    files: [
      {
        path: "components/transport/transport-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["transport", "ui"],
  },
  {
    name: "sortable-list-demo",
    description: "Sortable list component examples",
    type: "registry:example",
    registryDependencies: ["@audio/sortable-list"],
    files: [
      {
        path: "components/sortable-list/sortable-list-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["sortable-list", "ui"],
  },
  {
    name: "player-playback-speed-demo",
    description: "Playback speed component example",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      {
        path: "components/playback-speed/player-playback-speed-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["playback-speed"],
  },
  {
    name: "fader-vertical-demo",
    description: "Vertical fader",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "components/fader/fader-vertical-demo.tsx",
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
        path: "components/fader/fader-horizontal-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["fader"],
  },
  {
    name: "fader-size-variants-demo",
    description: "Fader size variants (sm, default, lg)",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "components/fader/fader-size-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["fader"],
  },
  {
    name: "fader-thumb-marks-variants-demo",
    description: "Fader thumb marks variants (off, 1, 4)",
    type: "registry:example",
    registryDependencies: ["@audio/fader"],
    files: [
      {
        path: "components/fader/fader-thumb-marks-variants-demo.tsx",
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
        path: "components/knob/knob-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-disabled-demo",
    description: "Knob disabled vs enabled comparison",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "components/knob/knob-disabled-demo.tsx",
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
        path: "components/knob/knob-size-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-fine-step-demo",
    description: "Knob with fine-grained step control (0.01)",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "components/knob/knob-fine-step-demo.tsx",
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
        path: "components/knob/knob-filter-control-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-change-vs-commit-demo",
    description: "Knob live value vs committed value callbacks",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "components/knob/knob-change-vs-commit-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-arc-and-anchor-demo",
    description: "Knob value arc (rail + highlight) and optional anchor range",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "components/knob/knob-arc-and-anchor-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-circular-arc-demo",
    description: "Knob with default arc pointer mapping and live value",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "components/knob/knob-circular-arc-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-double-tap-reset-demo",
    description: "Knob double-tap / double-click reset to defaultValue",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "components/knob/knob-double-tap-reset-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-revolution-drag-demo",
    description: "Knob with revolution (360°) drag sensitivity",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "components/knob/knob-revolution-drag-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "knob-vertical-drag-demo",
    description:
      "Knob with vertical fader-style pan via dragOptions.verticalPanEnabled",
    type: "registry:example",
    registryDependencies: ["@audio/knob"],
    files: [
      {
        path: "components/knob/knob-vertical-drag-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["knob"],
  },
  {
    name: "xypad-live-value-demo",
    description: "XYPad with live x/y readout",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "components/xypad/xypad-live-value-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-size-sm-demo",
    description: "XYPad size small example",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "components/xypad/xypad-size-sm-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-size-default-demo",
    description: "XYPad size default example",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "components/xypad/xypad-size-default-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-size-lg-demo",
    description: "XYPad size large example",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "components/xypad/xypad-size-lg-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-size-xl-demo",
    description: "XYPad size extra large example",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "components/xypad/xypad-size-xl-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-disabled-demo",
    description: "XYPad disabled state example",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "components/xypad/xypad-disabled-demo.tsx",
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
        path: "components/xypad/xypad-format-value-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-bipolar-range-demo",
    description: "XYPad with bipolar pan/mix style ranges",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "components/xypad/xypad-bipolar-range-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
  {
    name: "xypad-change-vs-commit-demo",
    description: "XYPad live value vs committed value callbacks",
    type: "registry:example",
    registryDependencies: ["@audio/xypad"],
    files: [
      {
        path: "components/xypad/xypad-change-vs-commit-demo.tsx",
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
        path: "components/xypad/xypad-hide-value-demo.tsx",
        type: "registry:example",
      },
    ],
    categories: ["xypad"],
  },
];
