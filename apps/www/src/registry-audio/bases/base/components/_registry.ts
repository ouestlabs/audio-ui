import type { RegistryItem } from "shadcn/schema";

export const components: RegistryItem[] = [
  {
    categories: ["synth", "xypad"],
    description: "Pocket synth with oscillator, filter, and XY pad",
    files: [
      {
        path: "components/synth/block-pocket-synth.tsx",
        type: "registry:block",
      },
    ],
    name: "block-pocket-synth",
    registryDependencies: [
      "@audio/use-web-audio",
      "@audio/fader",
      "@audio/xypad",
      "@shadcn/toggle-group",
    ],
    type: "registry:block",
  },
  {
    categories: ["synth", "xypad"],
    description: "Wave shaper synth with distortion, tone, and detune controls",
    files: [
      {
        path: "components/synth/block-wave-shaper.tsx",
        type: "registry:block",
      },
    ],
    name: "block-wave-shaper",
    registryDependencies: [
      "@audio/use-web-audio",
      "@audio/fader",
      "@audio/xypad",
      "@audio/knob",
      "@shadcn/toggle-group",
    ],
    type: "registry:block",
  },
  {
    categories: ["player", "queue"],
    description: "Audio player",
    files: [
      {
        path: "components/player/block-player.tsx",
        type: "registry:block",
      },
    ],
    name: "block-player",
    registryDependencies: ["@audio/player", "@audio/store", "@audio/html"],
    type: "registry:block",
  },
  {
    categories: ["player", "widget"],
    description: "Audio player with track list",
    files: [
      {
        path: "components/player/block-player-widget.tsx",
        type: "registry:block",
      },
    ],
    name: "block-player-widget",
    registryDependencies: ["@audio/player", "@audio/store", "@audio/html"],
    type: "registry:block",
  },
  {
    categories: ["queue", "ui"],
    description: "Queue controls",
    files: [
      {
        path: "components/queue/block-queue.tsx",
        type: "registry:block",
      },
    ],
    name: "block-queue",
    registryDependencies: ["@audio/player"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "transport"],
    description:
      "Channel strip with transport seek bar in vertical orientation",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-transport-vertical.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-transport-vertical",
    registryDependencies: ["@audio/channel-strip", "@audio/transport"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "transport"],
    description:
      "Channel strip with transport seek bar in horizontal orientation",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-transport.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-transport",
    registryDependencies: ["@audio/channel-strip", "@audio/transport"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with fader, header, and footer",
    files: [
      {
        path: "components/channel-strip/block-channel-strip.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with fader in horizontal orientation",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-horizontal.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-horizontal",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with a minimal fader section",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with bipolar gain fader (-60 dB to +6 dB)",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-gain-db.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader-gain-db",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader"],
    description: "Multiple fader channel strips in a row",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-multi.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader-multi",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob"],
    description: "Multiple knob channel strips in a row",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-multi.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-multi",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description:
      "Channel strip with a minimal fader section in horizontal orientation",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-horizontal.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader-horizontal",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with horizontal fader and inline label",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-slider.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader-slider",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob", "ui"],
    description: "Channel strip with a level knob",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-level.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-level",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob", "ui"],
    description: "Channel strip with an oversized macro knob",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-macro.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-macro",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob", "ui"],
    description: "Channel strip with a bipolar pan knob",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-pan.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-pan",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob", "ui"],
    description: "Channel strip with pan and width knobs in a row",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-pan-width.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-pan-width",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "xypad", "ui"],
    description: "Channel strip with an XY filter pad",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-xypad-filter.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-xypad-filter",
    registryDependencies: ["@audio/channel-strip", "@audio/xypad"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "xypad", "ui"],
    description: "Channel strip with XY spatial pad and wet knob",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-xypad-reverb.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-xypad-reverb",
    registryDependencies: [
      "@audio/channel-strip",
      "@audio/xypad",
      "@audio/knob",
    ],
    type: "registry:block",
  },
  {
    categories: ["player"],
    description: "Audio player demo",
    files: [
      {
        path: "components/player/player-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["player", "queue"],
    description: "Audio player with queue demo",
    files: [
      {
        path: "components/player/player-queue-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["player"],
    description: "AudioPlayer variant options (default, outline, ghost)",
    files: [
      {
        path: "components/player/player-variant-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-variant-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["player"],
    description: "AudioPlayer size options (sm, default, lg)",
    files: [
      {
        path: "components/player/player-size-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-size-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["player"],
    description: "Audio player with stacked layout",
    files: [
      {
        path: "components/player/player-stacked-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-stacked-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["queue"],
    description: "Minimal queue with shuffle and repeat controls",
    files: [
      {
        path: "components/queue/player-queue-shuffle-repeat-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-shuffle-repeat-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["queue"],
    description: "Minimal queue with preferences dropdown",
    files: [
      {
        path: "components/queue/player-queue-preferences-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-preferences-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["queue"],
    description: "Stacked player with queue and preferences",
    files: [
      {
        path: "components/queue/player-queue-simple-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-simple-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["queue"],
    description: "Queue with all controls (shuffle, repeat, preferences)",
    files: [
      {
        path: "components/queue/player-queue-all-controls-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-all-controls-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["track"],
    description: "Minimal track component example",
    files: [
      {
        path: "components/track/player-track-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["track"],
    description: "Track list with selection example",
    files: [
      {
        path: "components/track/player-track-list-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-list-demo",
    registryDependencies: ["@audio/player", "@audio/store"],
    type: "registry:example",
  },
  {
    categories: ["track", "grid"],
    description: "Track list with grid layout example",
    files: [
      {
        path: "components/track/player-track-list-grid-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-list-grid-demo",
    registryDependencies: ["@audio/player", "@audio/store"],
    type: "registry:example",
  },
  {
    categories: ["track", "sortable"],
    description: "Track list with sortable selection example",
    files: [
      {
        path: "components/track/player-track-sortable-list-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-sortable-list-demo",
    registryDependencies: ["@audio/player", "@audio/store"],
    type: "registry:example",
  },
  {
    categories: ["track", "sortable", "grid"],
    description: "Track list with sortable selection and grid layout example",
    files: [
      {
        path: "components/track/player-track-sortable-list-grid-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-sortable-list-grid-demo",
    registryDependencies: ["@audio/player", "@audio/store"],
    type: "registry:example",
  },
  {
    categories: ["transport", "ui"],
    description: "Transport timeline with buffered range example",
    files: [
      {
        path: "components/transport/transport-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "transport-demo",
    registryDependencies: ["@audio/transport"],
    type: "registry:example",
  },
  {
    categories: ["sortable-list", "ui"],
    description: "Sortable list component examples",
    files: [
      {
        path: "components/sortable-list/sortable-list-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sortable-list-demo",
    registryDependencies: ["@audio/sortable-list"],
    type: "registry:example",
  },
  {
    categories: ["playback-speed"],
    description: "Playback speed component example",
    files: [
      {
        path: "components/playback-speed/player-playback-speed-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-playback-speed-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["fader"],
    description: "Vertical fader",
    files: [
      {
        path: "components/fader/fader-vertical-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-vertical-demo",
    registryDependencies: ["@audio/fader"],
    type: "registry:example",
  },
  {
    categories: ["fader"],
    description: "Fader component example with horizontal orientation",
    files: [
      {
        path: "components/fader/fader-horizontal-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-horizontal-demo",
    registryDependencies: ["@audio/fader"],
    type: "registry:example",
  },
  {
    categories: ["fader"],
    description: "Fader size variants (sm, default, lg)",
    files: [
      {
        path: "components/fader/fader-size-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-size-variants-demo",
    registryDependencies: ["@audio/fader"],
    type: "registry:example",
  },
  {
    categories: ["fader"],
    description: "Fader thumb marks variants (off, 1, 4)",
    files: [
      {
        path: "components/fader/fader-thumb-marks-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-thumb-marks-variants-demo",
    registryDependencies: ["@audio/fader"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob component example",
    files: [
      {
        path: "components/knob/knob-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob disabled vs enabled comparison",
    files: [
      {
        path: "components/knob/knob-disabled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-disabled-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob component example with size variants",
    files: [
      {
        path: "components/knob/knob-size-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-size-variants-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob with fine-grained step control (0.01)",
    files: [
      {
        path: "components/knob/knob-fine-step-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-fine-step-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob component example with filter control",
    files: [
      {
        path: "components/knob/knob-filter-control-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-filter-control-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob live value vs committed value callbacks",
    files: [
      {
        path: "components/knob/knob-change-vs-commit-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-change-vs-commit-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob value arc (rail + highlight) and optional anchor range",
    files: [
      {
        path: "components/knob/knob-arc-and-anchor-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-arc-and-anchor-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob with default arc pointer mapping and live value",
    files: [
      {
        path: "components/knob/knob-circular-arc-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-circular-arc-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob double-tap / double-click reset to defaultValue",
    files: [
      {
        path: "components/knob/knob-double-tap-reset-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-double-tap-reset-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob with revolution (360°) drag sensitivity",
    files: [
      {
        path: "components/knob/knob-revolution-drag-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-revolution-drag-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description:
      "Knob with vertical fader-style pan via dragOptions.verticalPanEnabled",
    files: [
      {
        path: "components/knob/knob-vertical-drag-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-vertical-drag-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad with live x/y readout",
    files: [
      {
        path: "components/xypad/xypad-live-value-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-live-value-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad size small example",
    files: [
      {
        path: "components/xypad/xypad-size-sm-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-size-sm-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad size default example",
    files: [
      {
        path: "components/xypad/xypad-size-default-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-size-default-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad size large example",
    files: [
      {
        path: "components/xypad/xypad-size-lg-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-size-lg-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad size extra large example",
    files: [
      {
        path: "components/xypad/xypad-size-xl-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-size-xl-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad disabled state example",
    files: [
      {
        path: "components/xypad/xypad-disabled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-disabled-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad component example with formatted value",
    files: [
      {
        path: "components/xypad/xypad-format-value-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-format-value-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad with bipolar pan/mix style ranges",
    files: [
      {
        path: "components/xypad/xypad-bipolar-range-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-bipolar-range-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad live value vs committed value callbacks",
    files: [
      {
        path: "components/xypad/xypad-change-vs-commit-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-change-vs-commit-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad component example with hidden value",
    files: [
      {
        path: "components/xypad/xypad-hide-value-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-hide-value-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
];
