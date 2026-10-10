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
