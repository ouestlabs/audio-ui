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
    registryDependencies: ["@audio/filter-response"],
    type: "registry:ui",
  },
  {
    cssVars: {
      dark: { success: "oklch(0.696 0.17 162.48)" },
      light: { success: "oklch(0.696 0.17 162.48)" },
      theme: { "color-success": "var(--success)" },
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
      {
        path: "components/timeline/timeline-demo.tsx",
        target: "components/audio/timeline-default.tsx",
        type: "registry:component",
      },
    ],
    name: "timeline",
    registryDependencies: ["@audio/musical-time"],
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
];
