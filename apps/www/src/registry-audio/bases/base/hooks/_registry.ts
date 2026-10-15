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
    registryDependencies: ["@audio-ui/web-audio"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "timeline"],
    dependencies: ["@audio-ui/react"],
    description:
      "A transport clock as a live source for a timeline: it runs while playing, loops between two points, and the playhead follows it without re-rendering React",
    files: [
      {
        path: "hooks/use-playback-clock.ts",
        type: "registry:hook",
      },
    ],
    name: "use-playback-clock",
    registryDependencies: [],
    type: "registry:hook",
  },
  {
    categories: ["audio", "timeline"],
    dependencies: [],
    description:
      "A selection rectangle for the clips of a timeline: drag across bare lane (with Shift, or in a multi-select mode) and the clips it touches join the selection",
    files: [
      {
        path: "hooks/use-marquee-selection.ts",
        type: "registry:hook",
      },
    ],
    name: "use-marquee-selection",
    registryDependencies: [],
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
    registryDependencies: ["@audio-ui/arrangement", "@audio-ui/undo-history"],
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
    dependencies: ["@audio-ui/core@^0.4.0"],
    registryDependencies: ["@audio-ui/use-web-audio"],
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
    registryDependencies: ["@audio-ui/use-web-audio"],
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
    registryDependencies: ["@audio-ui/envelope-ramp"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "piano", "synth"],
    dependencies: ["@audio-ui/core@^0.3.0"],
    files: [
      {
        path: "hooks/use-midi-input.ts",
        type: "registry:hook",
      },
    ],
    name: "use-midi-input",
    registryDependencies: [],
    type: "registry:hook",
  },
  {
    categories: ["hooks", "audio", "tuner"],
    description:
      "The microphone as an AnalyserNode on the shared AudioContext: raw signal, never connected to the speakers, released on stop and on unmount",
    files: [
      {
        path: "hooks/use-microphone.ts",
        type: "registry:hook",
      },
    ],
    name: "use-microphone",
    registryDependencies: ["@audio-ui/use-web-audio"],
    type: "registry:hook",
  },
  {
    categories: ["hooks", "audio", "tuner"],
    dependencies: ["@audio-ui/react", "@audio-ui/core@^0.3.0"],
    description:
      "The pitch of a signal as a live source: the note nearest the sound and its offset in cents, steadied by a median and held a moment after the sound stops, with no React render per reading",
    files: [
      {
        path: "hooks/use-pitch.ts",
        type: "registry:hook",
      },
    ],
    name: "use-pitch",
    registryDependencies: [],
    type: "registry:hook",
  },
  {
    categories: ["hooks", "audio", "meter"],
    dependencies: ["@audio-ui/react"],
    description:
      "The live levels of a signal from its AnalyserNodes, in the shape a Meter paints from: RMS in dB per channel with a peak that holds and falls, refreshed every frame without re-rendering",
    files: [
      {
        path: "hooks/use-audio-levels.ts",
        type: "registry:hook",
      },
    ],
    name: "use-audio-levels",
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
      "The spectrum of an AnalyserNode as a live source for Plot.Trace: dB per point on a logarithmic frequency axis, refreshed every frame without re-rendering, and its held peaks as a second source",
    files: [
      {
        path: "hooks/use-spectrum.ts",
        type: "registry:hook",
      },
    ],
    name: "use-spectrum",
    registryDependencies: ["@audio-ui/spectrum"],
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
    registryDependencies: [
      "@audio-ui/use-web-audio",
      "@audio-ui/filter-response",
    ],
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
    registryDependencies: ["@audio-ui/use-web-audio"],
    type: "registry:hook",
  },
];
