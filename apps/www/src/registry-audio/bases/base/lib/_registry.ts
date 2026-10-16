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
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The compressor as a device: its parameters and what they mean, the numbers that go on the nodes for a state, and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/compressor-device.ts",
        target: "components/audio-ui/devices/compressor/device.ts",
        type: "registry:lib",
      },
    ],
    name: "compressor-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "A compressor on the Web Audio API for a compressor state: the node, its make-up taken back out or kept, a dry and compressed mix aligned to the node's lookahead, parameters that move without a click.",
    files: [
      {
        path: "lib/compressor-engine.ts",
        target: "components/audio-ui/devices/compressor/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "compressor-engine",
    registryDependencies: ["@audio-ui/compressor-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Pocket Synth as an instrument device: its waveform, filter and volume, and the pitch and filter cutoff a position on a pad plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/pocket-synth-device.ts",
        target: "components/audio-ui/devices/pocket-synth/device.ts",
        type: "registry:lib",
      },
    ],
    name: "pocket-synth-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "A monophonic synth on the Web Audio API for a Pocket Synth state: noteOn starts a note or glides the held one, noteOff releases it, and the wave, filter and volume follow the state without a click.",
    files: [
      {
        path: "lib/pocket-synth-engine.ts",
        target: "components/audio-ui/devices/pocket-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "pocket-synth-engine",
    registryDependencies: ["@audio-ui/pocket-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Wave Shaper as an instrument device: its waveform, drive, tone, detune, mix and volume, the pitch and resonance a pad position plays, and the distortion curve, with no panel and no audio in it.",
    files: [
      {
        path: "lib/wave-shaper-device.ts",
        target: "components/audio-ui/devices/wave-shaper/device.ts",
        type: "registry:lib",
      },
    ],
    name: "wave-shaper-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "A wave shaper synth on the Web Audio API for a Wave Shaper state: two detuned oscillators, a distortion mixed in parallel and a low-pass filter; noteOn starts a note or glides the held one, noteOff releases it.",
    files: [
      {
        path: "lib/wave-shaper-engine.ts",
        target: "components/audio-ui/devices/wave-shaper/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "wave-shaper-engine",
    registryDependencies: ["@audio-ui/wave-shaper-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The delay as a device: its time, feedback, tone and mix, the numbers that go on the nodes for a state and the echoes a state makes, with no panel and no audio in it.",
    files: [
      {
        path: "lib/delay-device.ts",
        target: "components/audio-ui/devices/delay/device.ts",
        type: "registry:lib",
      },
    ],
    name: "delay-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A delay on the Web Audio API for a delay state: an echo that goes round a tone filter so each repeat is darker, mixed with the dry sound, with a time that bends like a tape instead of clicking.",
    files: [
      {
        path: "lib/delay-engine.ts",
        target: "components/audio-ui/devices/delay/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "delay-engine",
    registryDependencies: ["@audio-ui/delay-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The reverb as a device: its decay, pre-delay, damping and mix, the numbers that go on the nodes for a state, the decay a state draws and the impulse response of its room, with no panel and no audio in it.",
    files: [
      {
        path: "lib/reverb-device.ts",
        target: "components/audio-ui/devices/reverb/device.ts",
        type: "registry:lib",
      },
    ],
    name: "reverb-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A reverb on the Web Audio API for a reverb state: a convolver fed a room made from the decay and the damping, two of them cross-faded so a new room never clicks, after a pre-delay and mixed with the dry sound.",
    files: [
      {
        path: "lib/reverb-engine.ts",
        target: "components/audio-ui/devices/reverb/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "reverb-engine",
    registryDependencies: ["@audio-ui/reverb-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The filter as a device: a type, a cutoff and a resonance, the numbers that go on the node for a state and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/filter-device.ts",
        target: "components/audio-ui/devices/filter/device.ts",
        type: "registry:lib",
      },
    ],
    name: "filter-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A filter on the Web Audio API for a filter state: the node the curve draws, with the resonance in the unit it wants, and the signal going round it when it is off, moving without a click.",
    files: [
      {
        path: "lib/filter-engine.ts",
        target: "components/audio-ui/devices/filter/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "filter-engine",
    registryDependencies: ["@audio-ui/filter-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "web-audio"],
    dependencies: [],
    description:
      "Pink noise as an audio buffer: equal energy per octave, so a flat equalizer looks flat on a spectrum.",
    files: [
      {
        path: "lib/pink-noise.ts",
        type: "registry:lib",
      },
    ],
    name: "pink-noise",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "web-audio"],
    dependencies: [],
    description:
      "A two-second loop to put an effect on: a kick and a snare, a hat on the eighths and a short line of plucked notes, drawn once from the drum voices of the library and looped as a buffer.",
    files: [
      {
        path: "lib/demo-loop.ts",
        type: "registry:lib",
      },
    ],
    name: "demo-loop",
    registryDependencies: ["@audio-ui/drum-synthesis"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "plot"],
    dependencies: ["@audio-ui/core"],
    description:
      "The equalizer as a device: a low shelf, two bells and a high shelf with an output trim, their filters as a state describes them, and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/equalizer-device.ts",
        target: "components/audio-ui/devices/equalizer/device.ts",
        type: "registry:lib",
      },
    ],
    name: "equalizer-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "plot"],
    dependencies: ["@audio-ui/core"],
    description:
      "An equalizer on the Web Audio API for an equalizer state: four biquad filters in series with an output trim, the same filters its curve draws, moving without a click.",
    files: [
      {
        path: "lib/equalizer-engine.ts",
        target: "components/audio-ui/devices/equalizer/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "equalizer-engine",
    registryDependencies: ["@audio-ui/equalizer-device"],
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
    dependencies: ["@audio-ui/core"],
    description:
      "Moved: the peaks are in @audio-ui/core/analysis and the decoding is audio-decode, as this lib gave both.",
    files: [],
    name: "waveform-peaks",
    registryDependencies: ["@audio-ui/audio-decode"],
    type: "registry:lib",
  },
  ...movedToCore.map(
    ([name, entry]): RegistryItem => ({
      dependencies: ["@audio-ui/core"],
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
