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
      {
        path: "components/plot/plot-demo.tsx",
        target: "components/audio/plot-default.tsx",
        type: "registry:component",
      },
    ],
    name: "plot",
    registryDependencies: [
      "@audio/filter-response",
      "@audio/knob",
      "@audio/use-noise-through-eq",
      "@audio/use-spectrum",
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
        target: "components/audio/waveform-default.tsx",
        type: "registry:component",
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
    registryDependencies: [
      "@audio/musical-time",
      "@shadcn/button",
      "@shadcn/button-group",
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
      "@audio/use-midi-input",
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
        target: "components/audio/sequencer-default.tsx",
        type: "registry:component",
      },
    ],
    name: "sequencer",
    registryDependencies: [
      "@audio/use-master-bus",
      "@audio/use-transport-clock",
      "@audio/use-web-audio",
      "@audio/drum-synthesis",
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
        target: "components/audio/scrubber-default.tsx",
        type: "registry:component",
      },
    ],
    name: "scrubber",
    registryDependencies: ["@shadcn/button"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react", "@base-ui/react"],
    files: [
      {
        path: "audio/elements/transport.tsx",
        type: "registry:ui",
      },
      {
        path: "components/transport/transport-demo.tsx",
        target: "components/audio/transport-default.tsx",
        type: "registry:component",
      },
    ],
    name: "transport",
    registryDependencies: [
      "@audio/bpm-control",
      "@audio/musical-time",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/dropdown-menu",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
];
