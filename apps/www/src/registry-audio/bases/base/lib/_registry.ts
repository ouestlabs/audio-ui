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
    categories: ["lib", "audio", "piano", "synth"],
    dependencies: ["@audio-ui/core@^0.3.0"],
    description:
      "The page's one Web MIDI input, made with @audio-ui/core/midi: connect it from any button, and every component listening hears the same devices",
    files: [
      {
        path: "lib/midi-input.ts",
        type: "registry:lib",
      },
    ],
    name: "midi-input",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "sequencer", "piano"],
    dependencies: [],
    description:
      "Framework-agnostic core of the look-ahead scheduler, the drift-free stepping cursor and self-correcting catch-up loop behind use-transport-clock",
    files: [
      {
        path: "lib/lookahead-scheduler.ts",
        type: "registry:lib",
      },
    ],
    name: "lookahead-scheduler",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "waveform"],
    dependencies: [],
    description:
      "Framework-agnostic waveform DSP, decode audio bytes to samples, downsample to peak amplitudes, normalize, and reduce a live spectrum to frequency bands",
    files: [
      {
        path: "lib/waveform-peaks.ts",
        type: "registry:lib",
      },
    ],
    name: "waveform-peaks",
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
    categories: ["lib", "audio", "timeline"],
    dependencies: [],
    description:
      "Framework-agnostic musical time, bars and beats against seconds, fixed and zoom-adaptive grid divisions with triplets, ruler label spacing, and bar/beat readouts",
    files: [
      {
        path: "lib/musical-time.ts",
        type: "registry:lib",
      },
    ],
    name: "musical-time",
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
    categories: ["lib", "audio", "plot"],
    dependencies: [],
    description:
      "What a filter, an equalizer and a compressor do to a signal, as curves for a plot: biquad and EQ responses in dB per frequency, a compressor's transfer curve, and Hz/dB formatting",
    files: [
      {
        path: "lib/filter-response.ts",
        type: "registry:lib",
      },
    ],
    name: "filter-response",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "plot"],
    dependencies: [],
    description:
      "Resamples an analyser's linear frequency bins onto a logarithmic axis, taking the loudest bin each point covers",
    files: [
      {
        path: "lib/spectrum.ts",
        type: "registry:lib",
      },
    ],
    name: "spectrum",
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
  ["pitch-detection", "pitch"],
];

export const lib: RegistryItem[] = [
  ...items,
  ...movedToCore.map(
    ([name, entry]): RegistryItem => ({
      dependencies: ["@audio-ui/core@^0.3.0"],
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
