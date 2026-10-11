import type { RegistryItem } from "shadcn/schema";

export const lib: RegistryItem[] = [
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
    name: "web",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "synth", "piano", "envelope"],
    dependencies: [],
    description:
      "Note-to-frequency conversion and envelope-curve-to-gain-automation helpers for polyphonic synth voices",
    files: [
      {
        path: "lib/synth-voice.ts",
        type: "registry:lib",
      },
    ],
    name: "synth-voice",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "piano", "synth"],
    dependencies: [],
    description:
      "Web MIDI message parsing (note-on/note-off/velocity from raw MIDI bytes) plus Standard MIDI File (.mid) import/export, parseMidiFile/encodeMidiFile",
    files: [
      {
        path: "lib/midi.ts",
        type: "registry:lib",
      },
    ],
    name: "midi",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "sequencer", "piano"],
    dependencies: [],
    description:
      "Framework-free core of the look-ahead scheduler, the drift-free stepping cursor and self-correcting catch-up loop behind use-step-clock and use-transport-clock",
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
      "Framework-free waveform DSP, decode audio bytes to samples, downsample to peak amplitudes, normalize, and reduce a live spectrum to frequency bands",
    files: [
      {
        path: "lib/waveform-dsp.ts",
        type: "registry:lib",
      },
    ],
    name: "waveform-dsp",
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
        path: "lib/history.ts",
        type: "registry:lib",
      },
    ],
    name: "history",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "timeline"],
    dependencies: [],
    description:
      "Framework-free musical time, bars and beats against seconds, fixed and zoom-adaptive grid divisions with triplets, ruler label spacing, and bar/beat readouts",
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
      "One-shot percussion synthesis (kick, snare, hihat) built from oscillators and noise bursts",
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
