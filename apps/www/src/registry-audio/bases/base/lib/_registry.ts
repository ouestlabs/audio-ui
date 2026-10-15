import type { RegistryItem } from "shadcn/schema";

const items: RegistryItem[] = [
  {
    categories: ["lib", "audio", "web-audio"],
    dependencies: [],
    description: "Web Audio Lib",
    files: [
      {
        path: "lib/web-audio.ts",
        type: "registry:lib",
      },
    ],
    name: "web-audio",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "synth", "piano", "envelope"],
    dependencies: [],
    description:
      "Envelope curves to gain automation: slicing an envelope at its sustain and scheduling its ramps on a GainNode's AudioParam, for synth voices",
    files: [
      {
        path: "lib/envelope-ramp.ts",
        type: "registry:lib",
      },
    ],
    name: "envelope-ramp",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "waveform"],
    dependencies: [],
    description:
      "Decoding an audio file into samples with the Web Audio API (decodeAudioData), the step before the waveform maths of @audio-ui/core/analysis",
    files: [
      {
        path: "lib/audio-decode.ts",
        type: "registry:lib",
      },
    ],
    name: "audio-decode",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "timeline"],
    dependencies: ["@audio-ui/react"],
    description:
      "The pure side of an arrangement of clips on tracks: laying a clip so it covers what is under it, landing a dragged group (or its copies) on another track, shifting tracks, and rescaling clips when the tempo changes",
    files: [
      {
        path: "lib/arrangement.ts",
        type: "registry:lib",
      },
    ],
    name: "arrangement",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "timeline"],
    dependencies: [],
    description:
      "Undo and redo as a value: a pure history of any document, with bursts (a drag is one entry), redo that drops on a new change, and a depth limit",
    files: [
      {
        path: "lib/undo-history.ts",
        type: "registry:lib",
      },
    ],
    name: "undo-history",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "piano", "ai"],
    dependencies: ["zod"],
    description:
      "AI-native tool surface for a piano roll, createPianoRollTools builds typed, agent-agnostic tools (setNotes/addNotes/removeNotes/transpose/clear/setTempo) an LLM calls to compose melodies and basslines from natural language, parameterized by the roll's pitch range and grid",
    files: [
      {
        path: "lib/piano-roll-tools.ts",
        type: "registry:lib",
      },
    ],
    name: "piano-roll-tools",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "synth", "sequencer"],
    dependencies: [],
    description:
      "One-shot percussion synthesis (kick, snare, hihat) built from oscillators and noise bursts, each with its own tune and decay",
    files: [
      {
        path: "lib/drum-synthesis.ts",
        type: "registry:lib",
      },
    ],
    name: "drum-synthesis",
    registryDependencies: [],
    type: "registry:lib",
  },
];

/**
 * Names that were renamed. Each installs its new name, so a command copied
 * from an older page or answer still works; remove them once they are old
 * enough. They carry no file of their own.
 */
const renamed: [from: string, to: string][] = [
  ["web", "web-audio"],
  ["waveform-dsp", "waveform-peaks"],
  ["history", "undo-history"],
  ["synth-voice", "envelope-ramp"],
];

/** Libs that moved into `@audio-ui/core`: they install the package, which has them. */
const movedToCore: [name: string, entry: string][] = [
  ["midi", "midi"],
  ["midi-input", "midi"],
  ["pitch-detection", "pitch"],
  ["musical-time", "time"],
  ["lookahead-scheduler", "time"],
  ["spectrum", "analysis"],
  ["filter-response", "analysis"],
];

export const lib: RegistryItem[] = [
  ...items,
  {
    dependencies: ["@audio-ui/core@^0.5.0"],
    description:
      "Moved: the peaks are in @audio-ui/core/analysis and the decoding is audio-decode, as this lib gave both.",
    files: [],
    name: "waveform-peaks",
    registryDependencies: ["@audio-ui/audio-decode"],
    type: "registry:lib",
  },
  ...movedToCore.map(
    ([name, entry]): RegistryItem => ({
      dependencies: ["@audio-ui/core@^0.5.0"],
      description: `Moved to @audio-ui/core/${entry}: installs the package.`,
      files: [],
      name,
      type: "registry:lib",
    })
  ),
  ...renamed.map(
    ([from, to]): RegistryItem => ({
      description: `Renamed to ${to}: installs it.`,
      files: [],
      name: from,
      registryDependencies: [`@audio-ui/${to}`],
      type: "registry:lib",
    })
  ),
];
