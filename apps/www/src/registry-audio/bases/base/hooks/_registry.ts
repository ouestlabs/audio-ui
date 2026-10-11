import type { RegistryItem } from "shadcn/schema";

export const hooks: RegistryItem[] = [
  {
    categories: ["audio", "web-audio"],
    files: [
      {
        path: "hooks/use-web-audio.ts",
        type: "registry:hook",
      },
    ],
    name: "use-web-audio",
    registryDependencies: ["@audio/web"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "timeline"],
    dependencies: ["@audio-ui/react"],
    description:
      "The state of an arrangement of clips on tracks, with its operations: selection, group moves and copies, split, duplicate, delete, adding and removing tracks, per-track mix and height, and undo and redo over tracks and clips",
    files: [
      {
        path: "hooks/use-arrangement.ts",
        type: "registry:hook",
      },
    ],
    name: "use-arrangement",
    registryDependencies: ["@audio/arrangement", "@audio/history"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "sequencer", "piano"],
    files: [
      {
        path: "hooks/use-transport-clock.ts",
        type: "registry:hook",
      },
    ],
    name: "use-transport-clock",
    registryDependencies: [
      "@audio/use-web-audio",
      "@audio/lookahead-scheduler",
    ],
    type: "registry:hook",
  },
  {
    categories: ["audio", "synth", "sequencer"],
    files: [
      {
        path: "hooks/use-master-bus.ts",
        type: "registry:hook",
      },
    ],
    name: "use-master-bus",
    registryDependencies: ["@audio/use-web-audio"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "synth", "piano", "envelope"],
    files: [
      {
        path: "hooks/use-synth-voices.ts",
        type: "registry:hook",
      },
    ],
    name: "use-synth-voices",
    registryDependencies: ["@audio/synth-voice"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "piano", "synth"],
    files: [
      {
        path: "hooks/use-midi-input.ts",
        type: "registry:hook",
      },
    ],
    name: "use-midi-input",
    registryDependencies: ["@audio/midi"],
    type: "registry:hook",
  },
  {
    categories: ["hooks", "audio", "meter"],
    dependencies: [],
    description:
      "Levels that move on their own, with a peak that holds and falls, in the shape a Meter paints from: a demo meter that is never at rest",
    files: [
      {
        path: "hooks/use-simulated-levels.ts",
        type: "registry:hook",
      },
    ],
    name: "use-simulated-levels",
    type: "registry:hook",
  },
  {
    categories: ["hooks", "audio", "plot"],
    dependencies: ["@audio-ui/react"],
    description:
      "The spectrum of an AnalyserNode as a live source for Plot.Trace: dB per point on a logarithmic frequency axis, refreshed every frame without re-rendering",
    files: [
      {
        path: "hooks/use-spectrum.ts",
        type: "registry:hook",
      },
    ],
    name: "use-spectrum",
    registryDependencies: ["@audio/spectrum"],
    type: "registry:hook",
  },
  {
    categories: ["hooks", "audio", "plot"],
    dependencies: [],
    description:
      "Pink noise played through an equalizer that follows your bands, with the analyser after it: what a plot draws is what is heard",
    files: [
      {
        path: "hooks/use-noise-through-eq.ts",
        type: "registry:hook",
      },
    ],
    name: "use-noise-through-eq",
    registryDependencies: ["@audio/use-web-audio", "@audio/filter-response"],
    type: "registry:hook",
  },
  {
    categories: ["hooks", "audio", "plot"],
    dependencies: ["@audio-ui/react"],
    description:
      "A looping pulse played through a compressor that follows your controls, with the level going in as a live source in dB: pair it with a transfer curve's Plot.Dot",
    files: [
      {
        path: "hooks/use-pulses-through-compressor.ts",
        type: "registry:hook",
      },
    ],
    name: "use-pulses-through-compressor",
    registryDependencies: ["@audio/use-web-audio"],
    type: "registry:hook",
  },
];
