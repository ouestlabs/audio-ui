import type { Registry } from "shadcn/schema";

export const blocks: Registry["items"] = [
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
    files: [{ path: "blocks/block-pocket-synth.tsx", type: "registry:block" }],
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
    files: [{ path: "blocks/block-wave-shaper.tsx", type: "registry:block" }],
    categories: ["synth", "xypad"],
  },
  {
    name: "block-player",
    description: "Audio player",
    type: "registry:block",
    registryDependencies: [
      "@audio/player",
      "@audio/queue",
      "@audio/store",
      "@audio/html",
    ],
    files: [{ path: "blocks/block-player.tsx", type: "registry:block" }],
    categories: ["player", "queue"],
  },
  {
    name: "block-player-widget",
    description: "Audio player with track list",
    type: "registry:block",
    registryDependencies: [
      "@audio/provider",
      "@audio/player",
      "@audio/queue",
      "@audio/track",
      "@audio/store",
      "@audio/html",
    ],
    files: [{ path: "blocks/block-player-widget.tsx", type: "registry:block" }],
    categories: ["player", "widget"],
  },
  {
    name: "block-queue",
    description: "Queue controls",
    type: "registry:block",
    registryDependencies: ["@audio/player", "@audio/queue"],
    files: [{ path: "blocks/block-queue.tsx", type: "registry:block" }],
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
        path: "blocks/block-channel-strip-transport-vertical.tsx",
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
        path: "blocks/block-channel-strip-transport.tsx",
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
    files: [{ path: "blocks/block-channel-strip.tsx", type: "registry:block" }],
    categories: ["channel-strip", "fader", "ui"],
  },
  {
    name: "block-channel-strip-horizontal",
    description: "Channel strip with fader in horizontal orientation",
    type: "registry:block",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    files: [
      {
        path: "blocks/block-channel-strip-horizontal.tsx",
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
      { path: "blocks/block-channel-strip-fader.tsx", type: "registry:block" },
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
        path: "blocks/block-channel-strip-fader-gain-db.tsx",
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
        path: "blocks/block-channel-strip-fader-multi.tsx",
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
        path: "blocks/block-channel-strip-knob-multi.tsx",
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
        path: "blocks/block-channel-strip-fader-horizontal.tsx",
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
        path: "blocks/block-channel-strip-fader-slider.tsx",
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
        path: "blocks/block-channel-strip-knob-level.tsx",
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
        path: "blocks/block-channel-strip-knob-macro.tsx",
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
        path: "blocks/block-channel-strip-knob-pan.tsx",
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
        path: "blocks/block-channel-strip-knob-pan-width.tsx",
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
        path: "blocks/block-channel-strip-xypad-filter.tsx",
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
        path: "blocks/block-channel-strip-xypad-reverb.tsx",
        type: "registry:block",
      },
    ],
    categories: ["channel-strip", "xypad", "ui"],
  },
];
