import type { RegistryItem } from "shadcn/schema";

export const audio: RegistryItem[] = [
  {
    name: "ui",
    registryDependencies: ["@audio/transport", "@audio/sortable-list"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/transport.tsx",
        type: "registry:ui",
      },
    ],
    name: "transport",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/envelope.tsx",
        type: "registry:ui",
      },
    ],
    name: "envelope",
    type: "registry:ui",
  },
  {
    dependencies: [
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@phosphor-icons/react",
    ],
    files: [
      {
        path: "audio/sortable-list.tsx",
        type: "registry:ui",
      },
    ],
    name: "sortable-list",
    registryDependencies: ["@shadcn/button"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/knob.tsx",
        type: "registry:ui",
      },
    ],
    name: "knob",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/fader.tsx",
        type: "registry:ui",
      },
    ],
    name: "fader",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/xypad.tsx",
        type: "registry:ui",
      },
    ],
    name: "xypad",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/sequencer.tsx",
        type: "registry:ui",
      },
    ],
    name: "sequencer",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/piano.tsx",
        type: "registry:ui",
      },
    ],
    name: "piano",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/piano-roll.tsx",
        type: "registry:ui",
      },
    ],
    name: "piano-roll",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/plot.tsx",
        type: "registry:ui",
      },
    ],
    name: "plot",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/meter.tsx",
        type: "registry:ui",
      },
    ],
    name: "meter",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/waveform.tsx",
        type: "registry:ui",
      },
    ],
    name: "waveform",
    registryDependencies: ["@audio/waveform-dsp"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/timeline.tsx",
        type: "registry:ui",
      },
    ],
    name: "timeline",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "audio/elements/bpm-control.tsx",
        type: "registry:ui",
      },
    ],
    name: "bpm-control",
    registryDependencies: ["@audio/channel-strip", "@shadcn/input-group"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "audio/elements/midi-connect-control.tsx",
        type: "registry:ui",
      },
    ],
    name: "midi-connect-control",
    registryDependencies: [
      "@audio/use-midi-input",
      "@shadcn/button",
      "@shadcn/button-group",
    ],
    type: "registry:ui",
  },
  {
    dependencies: [
      "@phosphor-icons/react",
      "class-variance-authority",
      "@base-ui/react",
    ],
    files: [
      {
        path: "audio/player.tsx",
        type: "registry:component",
      },
      {
        path: "hooks/use-audio-provider.ts",
        type: "registry:hook",
      },
      {
        path: "hooks/use-audio-session.ts",
        type: "registry:hook",
      },
    ],
    name: "player",
    registryDependencies: [
      "@audio/store",
      "@audio/html",
      "@audio/playback-engine",
      "@audio/fader",
      "@audio/transport",
      "@audio/sortable-list",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
      "@shadcn/spinner",
      "@shadcn/tooltip",
      "@shadcn/command",
      "@shadcn/dialog",
      "@shadcn/toggle",
      "@shadcn/badge",
      "@shadcn/empty",
      "@shadcn/avatar",
      "@shadcn/item",
    ],
    type: "registry:component",
  },
  {
    files: [
      {
        path: "audio/elements/channel-strip.tsx",
        target: "components/audio/channel-strip.tsx",
        type: "registry:component",
      },
    ],
    name: "channel-strip",
    type: "registry:component",
  },
];
