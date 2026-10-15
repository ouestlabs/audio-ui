import type { RegistryItem } from "shadcn/schema";

export const audio: RegistryItem[] = [
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
        path: "audio/elements/pad.tsx",
        type: "registry:ui",
      },
    ],
    name: "pad",
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
    registryDependencies: ["@audio-ui/timeline"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/tuner.tsx",
        type: "registry:ui",
      },
    ],
    name: "tuner",
    registryDependencies: ["@audio-ui/use-pitch"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/spectrum-analyzer.tsx",
        type: "registry:ui",
      },
    ],
    name: "spectrum-analyzer",
    registryDependencies: ["@audio-ui/plot", "@audio-ui/use-spectrum"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react", "@audio-ui/core@^0.5.0"],
    files: [
      {
        path: "audio/elements/plot.tsx",
        type: "registry:ui",
      },
      {
        path: "components/plot/plot-demo.tsx",
        target: "components/audio-ui/plot-default.tsx",
        type: "registry:component",
      },
    ],
    name: "plot",
    registryDependencies: [
      "@audio-ui/knob",
      "@audio-ui/use-noise-through-eq",
      "@audio-ui/use-spectrum",
      "@shadcn/button",
      "@shadcn/popover",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    cssVars: {
      dark: {
        success: "oklch(0.696 0.17 162.48)",
        warning: "oklch(0.795 0.184 86.047)",
      },
      light: {
        success: "oklch(0.696 0.17 162.48)",
        warning: "oklch(0.795 0.184 86.047)",
      },
      theme: {
        "color-success": "var(--success)",
        "color-warning": "var(--warning)",
      },
    },
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
      {
        path: "components/waveform/waveform-demo.tsx",
        target: "components/audio-ui/waveform-default.tsx",
        type: "registry:component",
      },
    ],
    name: "waveform",
    registryDependencies: [],
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
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/fader",
      "@audio-ui/knob",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/context-menu",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@base-ui/react"],
    files: [
      {
        path: "audio/elements/bpm-control.tsx",
        type: "registry:ui",
      },
    ],
    name: "bpm-control",
    registryDependencies: ["@shadcn/input-group"],
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
      "@audio-ui/use-midi-input",
      "@shadcn/button",
      "@shadcn/button-group",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/sequencer.tsx",
        type: "registry:ui",
      },
      {
        path: "components/sequencer/sequencer-demo.tsx",
        target: "components/audio-ui/sequencer-default.tsx",
        type: "registry:component",
      },
    ],
    name: "sequencer",
    registryDependencies: [
      "@audio-ui/use-master-bus",
      "@audio-ui/use-transport-clock",
      "@audio-ui/use-web-audio",
      "@audio-ui/drum-synthesis",
      "@shadcn/button",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "audio/elements/scrubber.tsx",
        type: "registry:ui",
      },
      {
        path: "components/scrubber/scrubber-demo.tsx",
        target: "components/audio-ui/scrubber-default.tsx",
        type: "registry:component",
      },
    ],
    name: "scrubber",
    registryDependencies: ["@shadcn/button"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "audio/elements/transport.tsx",
        type: "registry:ui",
      },
      {
        path: "components/transport/transport-demo.tsx",
        target: "components/audio-ui/transport-default.tsx",
        type: "registry:component",
      },
    ],
    name: "transport",
    dependencies: ["@audio-ui/core@^0.5.0"],
    registryDependencies: [
      "@audio-ui/bpm-control",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/dropdown-menu",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
];
