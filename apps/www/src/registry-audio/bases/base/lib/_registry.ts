import type { RegistryItem } from "shadcn/schema";

export const lib: RegistryItem[] = [
  {
    categories: ["lib", "audio", "playback-engine"],
    dependencies: [],
    description:
      "PlaybackEngine interface — the seam between the audio store and a device backend",
    files: [
      {
        path: "lib/playback-engine.ts",
        type: "registry:lib",
      },
    ],
    name: "playback-engine",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "html-audio"],
    dependencies: [],
    description: "HTML Audio Lib",
    files: [
      {
        path: "lib/html-audio.ts",
        type: "registry:lib",
      },
    ],
    name: "html",
    registryDependencies: ["@audio/playback-engine"],
    type: "registry:lib",
  },
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
    categories: ["lib", "audio", "store"],
    dependencies: ["zustand"],
    description: "Audio store",
    files: [
      {
        path: "lib/audio-store.ts",
        type: "registry:lib",
      },
    ],
    name: "store",
    registryDependencies: ["@audio/playback-engine"],
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
      "Web MIDI message parsing (note-on/note-off/velocity from raw MIDI bytes) plus Standard MIDI File (.mid) import/export — parseMidiFile/encodeMidiFile",
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
      "Framework-free core of the look-ahead scheduler — the drift-free stepping cursor and self-correcting catch-up loop behind use-step-clock and use-transport-clock",
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
      "Framework-free waveform DSP — decode audio bytes to samples, downsample to peak amplitudes, normalize, and lay out bars for rendering",
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
];
