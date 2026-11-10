import type { RegistryItem } from "shadcn/schema";

/**
 * The devices, each installed in one: its state, its engine and its panel,
 * to `components/audio-ui/devices/<name>/`. Each piece stays an item of its
 * own, for a panel over an engine of your own or an engine with no panel.
 */
const DEVICES = [
  "auto-pan",
  "binaural-panner",
  "bass-enhancer",
  "channel-eq",
  "chorus",
  "compander",
  "compressor",
  "deesser",
  "delay",
  "distortion",
  "ducker",
  "electric-piano",
  "equalizer",
  "exciter",
  "expander",
  "filter",
  "frequency-shifter",
  "fm-synth",
  "gate",
  "graphic-eq",
  "limiter",
  "lofi",
  "mid-side",
  "mono-synth",
  "organ",
  "string-machine",
  "tape-keys",
  "tilt-eq",
  "guitar",
  "drum-synth",
  "multiband",
  "overdrive",
  "phaser",
  "pocket-synth",
  "poly-synth",
  "redux",
  "reverb",
  "rotary",
  "sampler",
  "stutter",
  "saturator",
  "transient",
  "utility",
  "vibe",
  "wah",
  "wave-shaper",
];

const installs = DEVICES.map(
  (name): RegistryItem => ({
    categories: ["device"],
    description: `The ${name.replaceAll("-", " ")} device in one install: its state, its Web Audio engine and its panel, to components/audio-ui/devices/${name}/.`,
    files: [],
    name,
    registryDependencies: [
      `@audio-ui/${name}-device`,
      `@audio-ui/${name}-engine`,
      `@audio-ui/${name}-panel`,
    ],
    type: "registry:ui",
  })
);

export const devices: RegistryItem[] = [
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "The detector of a key: an AudioWorklet loaded once per context from a blob, which reads a signal and writes the gain a compressor would apply to it. The compressor's key and the de-esser use it.",
    files: [
      {
        path: "devices/key-detector.ts",
        target: "components/audio-ui/devices/key-detector.ts",
        type: "registry:lib",
      },
    ],
    name: "key-detector",
    registryDependencies: ["@audio-ui/compressor-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The auto pan as a device: a mode, a waveform, a rate and a depth, the numbers that go on the nodes for a state and the movement the oscillator makes, with no panel and no audio in it.",
    files: [
      {
        path: "devices/auto-pan/device.ts",
        target: "components/audio-ui/devices/auto-pan/device.ts",
        type: "registry:lib",
      },
    ],
    name: "auto-pan-device",
    registryDependencies: ["@audio-ui/synced-rate"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "An auto pan and tremolo on the Web Audio API for an auto pan state: one oscillator that moves a stereo panner or the level of a gain, by the mode, at a rate, a depth and a waveform.",
    files: [
      {
        path: "devices/auto-pan/engine.ts",
        target: "components/audio-ui/devices/auto-pan/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "auto-pan-engine",
    registryDependencies: ["@audio-ui/auto-pan-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the auto pan device: what the oscillator does to the pan or the level over two seconds, over the device knobs.",
    files: [
      {
        path: "devices/auto-pan/panel.tsx",
        target: "components/audio-ui/devices/auto-pan/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "auto-pan-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/auto-pan-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The channel EQ as a device: a low shelf, a sweepable mid bell, a high shelf, a high-pass switch and an output level, their filters as a state describes them and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "devices/channel-eq/device.ts",
        target: "components/audio-ui/devices/channel-eq/device.ts",
        type: "registry:lib",
      },
    ],
    name: "channel-eq-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A channel EQ on the Web Audio API for a channel EQ state: a high-pass, a low shelf, a mid bell and a high shelf in series with an output trim, the same filters its curve draws, moving without a click.",
    files: [
      {
        path: "devices/channel-eq/engine.ts",
        target: "components/audio-ui/devices/channel-eq/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "channel-eq-engine",
    registryDependencies: ["@audio-ui/channel-eq-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the channel EQ device: the curve it plays with a handle on the mid band and an optional live spectrum, over the shelf knobs and the high-pass switch.",
    files: [
      {
        path: "devices/channel-eq/panel.tsx",
        target: "components/audio-ui/devices/channel-eq/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "channel-eq-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/channel-eq-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/effect-chorus"],
    description:
      "The chorus as a device: a rate, a depth, a delay, one to eight voices and a mix, the numbers that go on the nodes for a state, the sweep of each voice's delay time and the source of the voices' worklet (the chorus of @audio/effect-chorus), with no panel and no audio in it.",
    files: [
      {
        path: "devices/chorus/device.ts",
        target: "components/audio-ui/devices/chorus/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/chorus/kernels.ts",
        target: "components/audio-ui/devices/chorus/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "chorus-device",
    registryDependencies: ["@audio-ui/synced-rate"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A chorus on the Web Audio API for a chorus state: a short delay whose time an oscillator sweeps, or two to eight voices in an AudioWorklet loaded from a blob, mixed with the dry sound, moving without a click.",
    files: [
      {
        path: "devices/chorus/engine.ts",
        target: "components/audio-ui/devices/chorus/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "chorus-engine",
    registryDependencies: ["@audio-ui/chorus-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the chorus device: the delay time of each voice as its oscillator sweeps it over two seconds, over the device knobs.",
    files: [
      {
        path: "devices/chorus/panel.tsx",
        target: "components/audio-ui/devices/chorus/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "chorus-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/chorus-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [
      "@audio-ui/core",
      "@audio/dynamics-compressor",
      "@audio/dynamics-fet",
      "@audio/dynamics-opto",
      "@audio/dynamics-varimu",
      "@audio/dynamics-vca",
    ],
    description:
      "The compressor as a device: its parameters and what they mean, its models (the browser's clean compressor, and the smooth, VCA, FET, opto and vari-mu compressors of @audio/dynamics-*), the numbers that go on the nodes for a state, the curve a state plays and the source of the models' worklet, with no panel and no audio in it.",
    files: [
      {
        path: "devices/compressor/device.ts",
        target: "components/audio-ui/devices/compressor/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/compressor/kernels.ts",
        target: "components/audio-ui/devices/compressor/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "compressor-device",
    registryDependencies: ["@audio-ui/manifest-worklet"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "A compressor on the Web Audio API for a compressor state: the node, its make-up taken back out or kept, a dry and compressed mix aligned to the node's lookahead, parameters that move without a click, a key (a worklet detector that ducks the signal from another one) and the other models in a worklet of their own, fed only while one plays.",
    files: [
      {
        path: "devices/compressor/engine.ts",
        target: "components/audio-ui/devices/compressor/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "compressor-engine",
    registryDependencies: [
      "@audio-ui/compressor-device",
      "@audio-ui/key-detector",
    ],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the compressor device: the model picked in its title bar, the transfer curve it plays, with the threshold and the level going in on it, over the device's knobs, those a model does not use drawn off.",
    files: [
      {
        path: "devices/compressor/panel.tsx",
        target: "components/audio-ui/devices/compressor/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "compressor-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/compressor-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/dynamics-deesser"],
    description:
      "The de-esser as a device: a frequency, a threshold, a ratio and a range, its models (the clean split, or the split, band and wide band de-essers of @audio/dynamics-deesser, which tell an s by the highs over the voice's body), the numbers that go on the nodes for a state, the table that keeps the highs above their floor, the response a state draws and the source of the other models' worklet, with no panel and no audio in it.",
    files: [
      {
        path: "devices/deesser/device.ts",
        target: "components/audio-ui/devices/deesser/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/deesser/kernels.ts",
        target: "components/audio-ui/devices/deesser/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "deesser-device",
    registryDependencies: ["@audio-ui/manifest-worklet"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A de-esser on the Web Audio API for a de-esser state: a Linkwitz-Riley split at the frequency, the highs read by the compressor's detector and taken down over the threshold, never under the range, and added back to the lows, or the other models in a worklet fed only while one plays.",
    files: [
      {
        path: "devices/deesser/engine.ts",
        target: "components/audio-ui/devices/deesser/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "deesser-engine",
    registryDependencies: [
      "@audio-ui/deesser-device",
      "@audio-ui/key-detector",
    ],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the de-esser device: the model picked in its title bar, what it does at each frequency with a handle at the frequency to drag across and up or down for the range, over the device knobs, those the model does not use drawn off.",
    files: [
      {
        path: "devices/deesser/panel.tsx",
        target: "components/audio-ui/devices/deesser/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "deesser-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/deesser-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [
      "@audio-ui/core",
      "@audio/effect-graindelay",
      "@audio/effect-multitap",
      "@audio/effect-pingpong",
    ],
    description:
      "The delay as a device: its mode (an echo, a ping-pong, a multitap or a grain delay), time, feedback, tone and mix, and the grain delay's pitch, spray, jitter and grain size, the numbers that go on the nodes for a state, the echoes a state makes and the worklet's source, with no panel and no audio in it.",
    files: [
      {
        path: "devices/delay/device.ts",
        target: "components/audio-ui/devices/delay/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/delay/kernels.ts",
        target: "components/audio-ui/devices/delay/kernels.ts",
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
      "A delay on the Web Audio API for a delay state: an echo that goes round a tone filter so each repeat is darker, mixed with the dry sound, with a time that bends like a tape instead of clicking, and the ping-pong, multitap and grain modes on an AudioWorklet loaded from a blob, fed only while one plays.",
    files: [
      {
        path: "devices/delay/engine.ts",
        target: "components/audio-ui/devices/delay/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "delay-engine",
    registryDependencies: ["@audio-ui/delay-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the delay device: the echoes it makes, one line each and fainter as they fade, with a handle on the first to drag its time and feedback, over the device's knobs.",
    files: [
      {
        path: "devices/delay/panel.tsx",
        target: "components/audio-ui/devices/delay/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "delay-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/delay-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/effect-distortion"],
    description:
      "The distortion as a device: a curve (tanh, cubic, hard or fold, the curves of @audio/effect-distortion), a drive, a tone, a mix and an output level, the numbers that go on the nodes for a state, the table of each curve and the transfer curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "devices/distortion/device.ts",
        target: "components/audio-ui/devices/distortion/device.ts",
        type: "registry:lib",
      },
    ],
    name: "distortion-device",
    registryDependencies: ["@audio-ui/oversampling"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A distortion on the Web Audio API for a distortion state: a drive gain into the table of its curve at 4x oversampling, a tone filter, mixed with the clean sound at an output level, moving without a click.",
    files: [
      {
        path: "devices/distortion/engine.ts",
        target: "components/audio-ui/devices/distortion/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "distortion-engine",
    registryDependencies: [
      "@audio-ui/distortion-device",
      "@audio-ui/oversampling",
    ],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the distortion device: its transfer curve against the straight line of a clean sound, over the choice of the curve, each button drawn from its curve, and the device knobs.",
    files: [
      {
        path: "devices/distortion/panel.tsx",
        target: "components/audio-ui/devices/distortion/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "distortion-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/curve-select",
      "@audio-ui/plot",
      "@audio-ui/distortion-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "A synthesized drum as a device: a kick, a snare, a clap, a closed or an open hat, a tom, a rim or a cymbal, with its tuning, decay, tone and snap, played by velocity. Its state, its description and the tools an agent plays it with.",
    files: [
      {
        path: "devices/drum-synth/device.ts",
        target: "components/audio-ui/devices/drum-synth/device.ts",
        type: "registry:lib",
      },
    ],
    name: "drum-synth-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Drum Synth on the Web Audio API: one engine plays every hit, each made of a falling sine and filtered noise when it comes, from a noise made once per context, ringing for its decay whatever the note's length.",
    files: [
      {
        path: "devices/drum-synth/engine.ts",
        target: "components/audio-ui/devices/drum-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "drum-synth-engine",
    registryDependencies: ["@audio-ui/drum-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "pad"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the Drum Synth device: its voice and tuning, decay, tone and snap, its volume, and a pad that strikes it, harder near its top.",
    files: [
      {
        path: "devices/drum-synth/panel.tsx",
        target: "components/audio-ui/devices/drum-synth/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "drum-synth-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/pad",
      "@audio-ui/drum-synth-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Electric Piano as an instrument device: a tine's body that barks and a bell that pings, rung down by itself, a pickup's drive and a tremolo, with four presets, and no panel and no audio in it.",
    files: [
      {
        path: "devices/electric-piano/device.ts",
        target: "components/audio-ui/devices/electric-piano/device.ts",
        type: "registry:lib",
      },
    ],
    name: "electric-piano-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the Electric Piano on the Web Audio API: noteOn strikes a note, which rings down by itself, or cuts the ringing one and strikes anew; noteOff lets it fall silent from where it got to; the drive, the tremolo and the volume follow the state without a click. A host plays chords with several.",
    files: [
      {
        path: "devices/electric-piano/engine.ts",
        target: "components/audio-ui/devices/electric-piano/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "electric-piano-engine",
    registryDependencies: ["@audio-ui/electric-piano-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the Electric Piano device: its four presets, its controls by what they do (tone, pickup, tremolo, output) and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/electric-piano/panel.tsx",
        target: "components/audio-ui/devices/electric-piano/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "electric-piano-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/piano",
      "@audio-ui/electric-piano-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "plot"],
    dependencies: ["@audio-ui/core"],
    description:
      "The equalizer as a device: a low shelf, two bells and a high shelf with an output trim, their filters as a state describes them, and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "devices/equalizer/device.ts",
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
        path: "devices/equalizer/engine.ts",
        target: "components/audio-ui/devices/equalizer/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "equalizer-engine",
    registryDependencies: ["@audio-ui/equalizer-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the equalizer device: the curve it plays with a handle on each band to drag its frequency and gain, an optional live spectrum behind it, over the device's knobs gathered by band.",
    files: [
      {
        path: "devices/equalizer/panel.tsx",
        target: "components/audio-ui/devices/equalizer/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "equalizer-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/equalizer-device",
      "@audio-ui/filter-type-select",
      "@shadcn/toggle",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [
      "@audio-ui/core",
      "@audio/filter-diode-ladder",
      "@audio/filter-korg35",
      "@audio/filter-moog-ladder",
      "@audio/filter-oberheim",
    ],
    description:
      "The filter as a device: a type, a circuit (clean, two Moog ladders, a diode ladder, a Korg35 or an Oberheim SEM), a cutoff, a resonance and a drive, the numbers that go on the node and the circuit worklet for a state, the worklet's source, and the curve a state plays, an analog circuit's measured on it, with no panel and no audio in it.",
    files: [
      {
        path: "devices/filter/device.ts",
        target: "components/audio-ui/devices/filter/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/filter/kernels.ts",
        target: "components/audio-ui/devices/filter/kernels.ts",
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
      "A filter on the Web Audio API for a filter state: the clean circuit a biquad node, an analog one an AudioWorklet loaded from a blob and fed only while it plays, the two cross-faded on a change of circuit, and the signal going round them when it is off, moving without a click.",
    files: [
      {
        path: "devices/filter/engine.ts",
        target: "components/audio-ui/devices/filter/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "filter-engine",
    registryDependencies: ["@audio-ui/filter-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the filter device: the curve its circuit plays with a handle on the cutoff to drag its frequency and resonance, an optional live spectrum behind it, the circuit picked in the title bar, over the device knobs.",
    files: [
      {
        path: "devices/filter/panel.tsx",
        target: "components/audio-ui/devices/filter/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "filter-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/filter-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The FM Synth as an instrument device: four operators, each a ratio, a level, a decay and a sustain, eight algorithms that wire them, feedback, an attack, a release and a vibrato, with eight presets, and no panel and no audio in it.",
    files: [
      {
        path: "devices/fm-synth/device.ts",
        target: "components/audio-ui/devices/fm-synth/device.ts",
        type: "registry:lib",
      },
    ],
    name: "fm-synth-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the FM Synth on the Web Audio API: four operators wired by the algorithm, each with its envelope; noteOn strikes a note, or cuts the held one and strikes anew, noteOff releases every operator from where it got to, and the levels, ratios, feedback and vibrato move a held note. A host plays chords with several.",
    files: [
      {
        path: "devices/fm-synth/engine.ts",
        target: "components/audio-ui/devices/fm-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "fm-synth-engine",
    registryDependencies: ["@audio-ui/fm-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the FM Synth device: its eight presets, what every operator shares, each operator's four controls and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/fm-synth/panel.tsx",
        target: "components/audio-ui/devices/fm-synth/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "fm-synth-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/piano",
      "@audio-ui/fm-synth-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/dynamics-gate"],
    description:
      "The gate as a device: a threshold, a floor, an attack, a hold, a release and a look-ahead, its models (clean, with a sidechain, or the hysteresis gate of @audio/dynamics-gate), the numbers that go on the nodes for a state, the detector worklet, the source of the hysteresis model's worklet and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "devices/gate/device.ts",
        target: "components/audio-ui/devices/gate/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/gate/kernels.ts",
        target: "components/audio-ui/devices/gate/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "gate-device",
    registryDependencies: ["@audio-ui/manifest-worklet"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A gate on the Web Audio API for a gate state: a worklet detector reads the key and writes the gain (threshold, attack, hold, release), and a delay in front of the gain gives the look-ahead, or the hysteresis model in a worklet fed only while it plays.",
    files: [
      {
        path: "devices/gate/engine.ts",
        target: "components/audio-ui/devices/gate/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "gate-engine",
    registryDependencies: ["@audio-ui/gate-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the gate device: the model picked in its title bar, its transfer curve against the straight line of a clean sound with a handle on the threshold and a line where the hysteresis model closes, over the device knobs, those the model does not use drawn off.",
    files: [
      {
        path: "devices/gate/panel.tsx",
        target: "components/audio-ui/devices/gate/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "gate-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/gate-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/dynamics-expander"],
    description:
      "The expander as a device: a mode (downward or upward), a threshold, a ratio, a knee, a range, an attack and a release, the numbers that go on the worklet for a state, the curve a state plays and the worklet's source (the expander of @audio/dynamics-expander), with no panel and no audio in it.",
    files: [
      {
        path: "devices/expander/device.ts",
        target: "components/audio-ui/devices/expander/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/expander/kernels.ts",
        target: "components/audio-ui/devices/expander/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "expander-device",
    registryDependencies: ["@audio-ui/manifest-worklet"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "An expander on the Web Audio API for an expander state: the expander of @audio/dynamics-expander in an AudioWorklet loaded from a blob, fed only while it plays, the sound passing unchanged until it is ready.",
    files: [
      {
        path: "devices/expander/engine.ts",
        target: "components/audio-ui/devices/expander/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "expander-engine",
    registryDependencies: ["@audio-ui/expander-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the expander device: the mode picked in its title bar, its transfer curve against the straight line of a clean sound with a handle on the threshold, over the device knobs.",
    files: [
      {
        path: "devices/expander/panel.tsx",
        target: "components/audio-ui/devices/expander/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "expander-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/expander-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [
      "@audio-ui/core",
      "@audio/dynamics-ducker",
      "@audio/dynamics-compressor",
    ],
    description:
      "The ducker as a device: a threshold, a ratio, a knee, a range, an attack and a release, the numbers that go on the worklet for a state, the gain it puts on the sound for a level of the key and the worklet's source (the ducker of @audio/dynamics-ducker), with no panel and no audio in it.",
    files: [
      {
        path: "devices/ducker/device.ts",
        target: "components/audio-ui/devices/ducker/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/ducker/kernels.ts",
        target: "components/audio-ui/devices/ducker/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "ducker-device",
    registryDependencies: ["@audio-ui/manifest-worklet"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A ducker on the Web Audio API for a ducker state: the ducker of @audio/dynamics-ducker in an AudioWorklet loaded from a blob, the sound on its first input and the key from the sidechain on its second, fed only while it plays, the sound passing unchanged until it is ready.",
    files: [
      {
        path: "devices/ducker/engine.ts",
        target: "components/audio-ui/devices/ducker/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "ducker-engine",
    registryDependencies: ["@audio-ui/ducker-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the ducker device: the gain it puts on the sound for each level of the key, with a handle on the threshold and the range it never goes under, over the device knobs.",
    files: [
      {
        path: "devices/ducker/panel.tsx",
        target: "components/audio-ui/devices/ducker/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "ducker-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/ducker-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/dynamics-compand"],
    description:
      "The compander as a device: the level out at -90, -60, -20 and 0 dB in, an attack and a release, the numbers that go on the worklet for a state, the curve a state plays, measured from the package's own stream, and the worklet's source (the compander of @audio/dynamics-compand), with no panel and no audio in it.",
    files: [
      {
        path: "devices/compander/device.ts",
        target: "components/audio-ui/devices/compander/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/compander/kernels.ts",
        target: "components/audio-ui/devices/compander/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "compander-device",
    registryDependencies: ["@audio-ui/manifest-worklet"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A compander on the Web Audio API for a compander state: the compander of @audio/dynamics-compand in an AudioWorklet loaded from a blob, fed only while it plays, the sound passing unchanged until it is ready.",
    files: [
      {
        path: "devices/compander/engine.ts",
        target: "components/audio-ui/devices/compander/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "compander-engine",
    registryDependencies: ["@audio-ui/compander-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the compander device: its transfer curve against the straight line of a clean sound, with a handle on each of its four points, over the device knobs.",
    files: [
      {
        path: "devices/compander/panel.tsx",
        target: "components/audio-ui/devices/compander/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "compander-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/compander-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The guitar as a device: a plucked string that rings and fades, its highs first, through the body's warmth and a tone control, with its decay and palm mute, with no panel and no audio in it.",
    files: [
      {
        path: "devices/guitar/device.ts",
        target: "components/audio-ui/devices/guitar/device.ts",
        type: "registry:lib",
      },
    ],
    name: "guitar-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The guitar's Web Audio engine: one plucked string, drawn when its note comes and in tune to the cent, through the body and the tone; a host plays chords with several.",
    files: [
      {
        path: "devices/guitar/engine.ts",
        target: "components/audio-ui/devices/guitar/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "guitar-engine",
    registryDependencies: ["@audio-ui/guitar-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The guitar's face: the string's tone, decay and palm mute, the body and the volume, and a keyboard from the open low E up three octaves, controlled, with no audio in it.",
    files: [
      {
        path: "devices/guitar/panel.tsx",
        target: "components/audio-ui/devices/guitar/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "guitar-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/piano",
      "@audio-ui/guitar-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/dynamics-limiter"],
    description:
      "The limiter as a device: an input gain, a ceiling and a release, its models (the browser's clean compressor and a clip, or the lookahead brickwall limiter of @audio/dynamics-limiter with its look-ahead and true peak), the numbers that go on the nodes for a state, the curve a state plays and the source of the look-ahead model's worklet, with no panel and no audio in it.",
    files: [
      {
        path: "devices/limiter/device.ts",
        target: "components/audio-ui/devices/limiter/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/limiter/kernels.ts",
        target: "components/audio-ui/devices/limiter/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "limiter-device",
    registryDependencies: [
      "@audio-ui/oversampling",
      "@audio-ui/manifest-worklet",
    ],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A limiter on the Web Audio API for a limiter state: the browser compressor node at a ratio of 20 with no knee, its make-up taken back out, or the look-ahead model in a worklet fed only while it plays, the signal going round both when it is off.",
    files: [
      {
        path: "devices/limiter/engine.ts",
        target: "components/audio-ui/devices/limiter/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "limiter-engine",
    registryDependencies: ["@audio-ui/limiter-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the limiter device: the model picked in its title bar, its transfer curve against the straight line of a clean sound with a handle for the ceiling and the input gain, over the device knobs, those the model does not use drawn off.",
    files: [
      {
        path: "devices/limiter/panel.tsx",
        target: "components/audio-ui/devices/limiter/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "limiter-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/limiter-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/spatial-microshift"],
    description:
      "The mid/side device as a device: a widening (off, a Haas delay or a detune, with their delay, cents and blend), a level for the mid, a level for the side and a bass mono frequency, the numbers that go on the nodes for a state and the source of the detune's worklet (the shifters of @audio/spatial-microshift), with no panel and no audio in it.",
    files: [
      {
        path: "devices/mid-side/device.ts",
        target: "components/audio-ui/devices/mid-side/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/mid-side/kernels.ts",
        target: "components/audio-ui/devices/mid-side/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "mid-side-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "A mid/side device on the Web Audio API for a mid/side state: the signal widened first, by a Haas delay or a detune in an AudioWorklet loaded from a blob, then split into mid and side, a level for each, a high-pass on the side for bass mono, and the two added back, moving without a click.",
    files: [
      {
        path: "devices/mid-side/engine.ts",
        target: "components/audio-ui/devices/mid-side/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "mid-side-engine",
    registryDependencies: ["@audio-ui/mid-side-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the mid/side device: a square with the side level across and the mid level up, and a handle to drag to both at once, over the bass mono and widening knobs, the widening picked in its title bar.",
    files: [
      {
        path: "devices/mid-side/panel.tsx",
        target: "components/audio-ui/devices/mid-side/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "mid-side-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/mid-side-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Mono Synth as an instrument device: a saw, square or triangle oscillator, a sub oscillator and noise, a resonant low-pass filter an envelope opens, a range, a glide and a vibrato, with eight presets, and no panel and no audio in it.",
    files: [
      {
        path: "devices/mono-synth/device.ts",
        target: "components/audio-ui/devices/mono-synth/device.ts",
        type: "registry:lib",
      },
    ],
    name: "mono-synth-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Mono Synth on the Web Audio API, the whole synth in one engine: it takes every note by its id, the first opens the envelope, a note while one is held glides to it, and letting go of it glides back to the one still held. Every control moves a held note.",
    files: [
      {
        path: "devices/mono-synth/engine.ts",
        target: "components/audio-ui/devices/mono-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "mono-synth-engine",
    registryDependencies: ["@audio-ui/mono-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core", "@audio-ui/icons"],
    description:
      "The face of the Mono Synth device: its eight presets, the oscillator's wave and the range in its title bar, its controls by what they do (oscillators, filter, envelope, glide and vibrato) and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/mono-synth/panel.tsx",
        target: "components/audio-ui/devices/mono-synth/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "mono-synth-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/piano",
      "@audio-ui/mono-synth-device",
      "@shadcn/select",
      "@shadcn/toggle-group",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The multiband compressor as a device: two splits and a threshold and ratio for each of the three bands, with an attack, a release and an output gain, the numbers that go on the nodes for a state and the bands a state draws, with no panel and no audio in it.",
    files: [
      {
        path: "devices/multiband/device.ts",
        target: "components/audio-ui/devices/multiband/device.ts",
        type: "registry:lib",
      },
    ],
    name: "multiband-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "A multiband compressor on the Web Audio API for a multiband state: a Linkwitz-Riley split in three bands that add back flat, and for each band the compressor's detector driving its gain.",
    files: [
      {
        path: "devices/multiband/engine.ts",
        target: "components/audio-ui/devices/multiband/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "multiband-engine",
    registryDependencies: [
      "@audio-ui/multiband-device",
      "@audio-ui/key-detector",
    ],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the multiband compressor device: the three bands drawn against frequency with a handle on each split, over the knobs of each band.",
    files: [
      {
        path: "devices/multiband/panel.tsx",
        target: "components/audio-ui/devices/multiband/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "multiband-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/multiband-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Organ as an instrument device: nine drawbars of sines at the organ's harmonics, a percussion on the second or third harmonic, a key click, a drive and a rotary speaker, with six registrations, and no panel and no audio in it.",
    files: [
      {
        path: "devices/organ/device.ts",
        target: "components/audio-ui/devices/organ/device.ts",
        type: "registry:lib",
      },
    ],
    name: "organ-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One key of the Organ on the Web Audio API: nine sines at the drawbars' levels, with the percussion and the click, through a drive and a rotary speaker; noteOn sounds a key at once, or cuts the held one and sounds anew, noteOff stops it at once, and the drawbars move a held key. A host plays chords with several.",
    files: [
      {
        path: "devices/organ/engine.ts",
        target: "components/audio-ui/devices/organ/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "organ-engine",
    registryDependencies: ["@audio-ui/organ-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the Organ device: its six registrations and the rotary speaker in its title bar, nine drawbars as faders, its percussion, key click, drive and volume, and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/organ/panel.tsx",
        target: "components/audio-ui/devices/organ/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "organ-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/fader",
      "@audio-ui/piano",
      "@audio-ui/organ-device",
      "@shadcn/select",
      "@shadcn/toggle-group",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The overdrive as a device: a band-pass before a soft clip with a drive, a tone and a mix, the numbers that go on the nodes for a state and the band that reaches the clip, with no panel and no audio in it.",
    files: [
      {
        path: "devices/overdrive/device.ts",
        target: "components/audio-ui/devices/overdrive/device.ts",
        type: "registry:lib",
      },
    ],
    name: "overdrive-device",
    registryDependencies: ["@audio-ui/oversampling"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "An overdrive on the Web Audio API for an overdrive state: a band-pass, a drive gain, a soft-clip table at 4x oversampling and a tone filter, mixed with the clean sound, moving without a click.",
    files: [
      {
        path: "devices/overdrive/engine.ts",
        target: "components/audio-ui/devices/overdrive/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "overdrive-engine",
    registryDependencies: [
      "@audio-ui/overdrive-device",
      "@audio-ui/oversampling",
    ],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the overdrive device: the band that reaches the clip with a handle on its centre, over the device knobs.",
    files: [
      {
        path: "devices/overdrive/panel.tsx",
        target: "components/audio-ui/devices/overdrive/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "overdrive-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/overdrive-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/effect-phaser"],
    description:
      "The phaser-flanger as a device: a mode (phaser, classic or flanger), a rate, a depth, a centre frequency, a delay, the classic phaser's stages, a feedback and a mix, the numbers that go on the nodes for a state, the sweep and the source of the classic phaser's worklet (the phaser of @audio/effect-phaser), with no panel and no audio in it.",
    files: [
      {
        path: "devices/phaser/device.ts",
        target: "components/audio-ui/devices/phaser/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/phaser/kernels.ts",
        target: "components/audio-ui/devices/phaser/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "phaser-device",
    registryDependencies: ["@audio-ui/synced-rate"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A phaser and flanger on the Web Audio API for a phaser state: four all-pass filters and a short delay swept by one oscillator, and the classic phaser's first-order stages in an AudioWorklet loaded from a blob, crossfaded by the mode, with feedback and a mix.",
    files: [
      {
        path: "devices/phaser/engine.ts",
        target: "components/audio-ui/devices/phaser/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "phaser-engine",
    registryDependencies: ["@audio-ui/phaser-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the phaser-flanger device: the sweep of its oscillator over two seconds, over the device knobs, with the ones the mode does not use drawn off, and the mode picked in its title bar.",
    files: [
      {
        path: "devices/phaser/panel.tsx",
        target: "components/audio-ui/devices/phaser/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "phaser-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/phaser-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Pocket Synth as an instrument device: its waveform, filter and volume, and the pitch and filter cutoff a position on a pad plays, with no panel and no audio in it.",
    files: [
      {
        path: "devices/pocket-synth/device.ts",
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
        path: "devices/pocket-synth/engine.ts",
        target: "components/audio-ui/devices/pocket-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "pocket-synth-engine",
    registryDependencies: ["@audio-ui/pocket-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "xypad"],
    dependencies: ["@audio-ui/react", "@audio-ui/icons"],
    description:
      "The face of the Pocket Synth device: a pad that plays it, its waveform and filter, and its volume. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/pocket-synth/panel.tsx",
        target: "components/audio-ui/devices/pocket-synth/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "pocket-synth-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/fader",
      "@audio-ui/waveform-select",
      "@audio-ui/xypad",
      "@audio-ui/pocket-synth-device",
      "@shadcn/toggle-group",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Poly Synth as an instrument device: a saw, a pulse, a sub oscillator and noise, a resonant low-pass filter that follows the keyboard, an envelope for the filter and the level, a vibrato and a chorus, with eight presets, and no panel and no audio in it.",
    files: [
      {
        path: "devices/poly-synth/device.ts",
        target: "components/audio-ui/devices/poly-synth/device.ts",
        type: "registry:lib",
      },
    ],
    name: "poly-synth-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the Poly Synth on the Web Audio API: noteOn starts a note or glides the held one, noteOff releases it from where its envelope got to, and every control follows the state without a click. A host plays chords with several.",
    files: [
      {
        path: "devices/poly-synth/engine.ts",
        target: "components/audio-ui/devices/poly-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "poly-synth-engine",
    registryDependencies: ["@audio-ui/poly-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the Poly Synth device: its eight presets, its controls by what they do (oscillators, filter, envelope, vibrato and chorus) and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/poly-synth/panel.tsx",
        target: "components/audio-ui/devices/poly-synth/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "poly-synth-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/piano",
      "@audio-ui/poly-synth-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/effect-lofi"],
    description:
      "The lo-fi as a device: its wow, flutter, hiss, crackle, the band a high-pass and a low-pass leave and a tape drive, the numbers that go on the worklet for a state, the band a state leaves and the worklet's source, with no panel and no audio in it.",
    files: [
      {
        path: "devices/lofi/device.ts",
        target: "components/audio-ui/devices/lofi/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/lofi/kernels.ts",
        target: "components/audio-ui/devices/lofi/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "lofi-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A lo-fi on the Web Audio API for a lo-fi state: the kernel of @audio/effect-lofi in an AudioWorklet loaded from a blob, the sound passing clean until it is ready and when it is off.",
    files: [
      {
        path: "devices/lofi/engine.ts",
        target: "components/audio-ui/devices/lofi/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "lofi-engine",
    registryDependencies: ["@audio-ui/lofi-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the lo-fi device: the band it leaves between its high-pass and its low-pass, over the device knobs.",
    files: [
      {
        path: "devices/lofi/panel.tsx",
        target: "components/audio-ui/devices/lofi/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "lofi-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/lofi-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The graphic EQ as a device: ten bands an octave apart, from 31 Hz to 16 kHz (the bands of @audio/eq-graphic), each a bell with a gain of its own, and an output level, the filters a state is and the curve it plays, with no panel and no audio in it.",
    files: [
      {
        path: "devices/graphic-eq/device.ts",
        target: "components/audio-ui/devices/graphic-eq/device.ts",
        type: "registry:lib",
      },
    ],
    name: "graphic-eq-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "A graphic EQ on the Web Audio API for a graphic EQ state: ten peaking filters in series and an output level, the same filters its curve draws, moving without a click.",
    files: [
      {
        path: "devices/graphic-eq/engine.ts",
        target: "components/audio-ui/devices/graphic-eq/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "graphic-eq-engine",
    registryDependencies: ["@audio-ui/graphic-eq-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "fader", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the graphic EQ device: the curve it plays over a fader for each of its ten bands, and the output knob beside them.",
    files: [
      {
        path: "devices/graphic-eq/panel.tsx",
        target: "components/audio-ui/devices/graphic-eq/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "graphic-eq-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/fader",
      "@audio-ui/plot",
      "@audio-ui/graphic-eq-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/biquad", "@audio/eq-tilt"],
    description:
      "The tilt EQ as a device: a tilt, a pivot and an output level, the numbers that go on the worklet for a state, the curve it plays (the shelves of @audio/biquad) and the worklet's source (the tilt of @audio/eq-tilt), with no panel and no audio in it.",
    files: [
      {
        path: "devices/tilt-eq/device.ts",
        target: "components/audio-ui/devices/tilt-eq/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/tilt-eq/kernels.ts",
        target: "components/audio-ui/devices/tilt-eq/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "tilt-eq-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A tilt EQ on the Web Audio API for a tilt EQ state: the tilt of @audio/eq-tilt in an AudioWorklet loaded from a blob, the sound passing clean until it is ready, then an output level.",
    files: [
      {
        path: "devices/tilt-eq/engine.ts",
        target: "components/audio-ui/devices/tilt-eq/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "tilt-eq-engine",
    registryDependencies: ["@audio-ui/tilt-eq-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the tilt EQ device: the curve it plays, tilted around a line at the pivot, over the device knobs.",
    files: [
      {
        path: "devices/tilt-eq/panel.tsx",
        target: "components/audio-ui/devices/tilt-eq/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "tilt-eq-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/tilt-eq-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [
      "@audio-ui/core",
      "@audio/effect-autowah",
      "@audio/effect-wah",
    ],
    description:
      "The wah as a device: a mode (envelope, sweep or pedal), the band's frequency and resonance, an envelope's range, sensitivity, attack and release, an oscillator's rate or note value and depth, a mix and an output, the numbers that go on the worklet for a state, the band's travel and curve and the worklet's source (the auto-wah of @audio/effect-autowah and the wah of @audio/effect-wah), with no panel and no audio in it.",
    files: [
      {
        path: "devices/wah/device.ts",
        target: "components/audio-ui/devices/wah/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/wah/kernels.ts",
        target: "components/audio-ui/devices/wah/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "wah-device",
    registryDependencies: ["@audio-ui/synced-rate"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A wah on the Web Audio API for a wah state: an AudioWorklet loaded from a blob that plays every mode, one output each, faded by the mode, mixed with the clean sound at an output level, the sound passing clean until it is ready.",
    files: [
      {
        path: "devices/wah/engine.ts",
        target: "components/audio-ui/devices/wah/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "wah-engine",
    registryDependencies: ["@audio-ui/wah-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the wah device: the band where it rests, and dashed where its travel ends, over the device knobs, the mode picked in its title bar.",
    files: [
      {
        path: "devices/wah/panel.tsx",
        target: "components/audio-ui/devices/wah/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "wah-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/wah-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [
      "@audio-ui/core",
      "@audio/effect-freqshift",
      "@audio/effect-ringmod",
    ],
    description:
      "The frequency shifter as a device: a mode (shift or ring), the shift in hertz, the ring's frequency, the shifter's precision and a mix, the numbers that go on the worklet for a state, its latency, what it does to a note and its harmonics and the worklet's source (the frequency shifter of @audio/effect-freqshift and the ring modulator of @audio/effect-ringmod), with no panel and no audio in it.",
    files: [
      {
        path: "devices/frequency-shifter/device.ts",
        target: "components/audio-ui/devices/frequency-shifter/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/frequency-shifter/kernels.ts",
        target: "components/audio-ui/devices/frequency-shifter/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "frequency-shifter-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A frequency shifter on the Web Audio API for a frequency shifter state: an AudioWorklet loaded from a blob that plays both modes, one output each, faded by the mode, the sound passing clean until it is ready.",
    files: [
      {
        path: "devices/frequency-shifter/engine.ts",
        target: "components/audio-ui/devices/frequency-shifter/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "frequency-shifter-engine",
    registryDependencies: ["@audio-ui/frequency-shifter-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the frequency shifter device: a note and its harmonics as they go in and as they come out, over the device knobs, the mode picked in its title bar.",
    files: [
      {
        path: "devices/frequency-shifter/panel.tsx",
        target: "components/audio-ui/devices/frequency-shifter/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "frequency-shifter-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/frequency-shifter-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/effect-exciter"],
    description:
      "The exciter as a device: a frequency, a drive and an amount, the numbers that go on the worklet for a state, the band it excites and the worklet's source (the exciter of @audio/effect-exciter), with no panel and no audio in it.",
    files: [
      {
        path: "devices/exciter/device.ts",
        target: "components/audio-ui/devices/exciter/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/exciter/kernels.ts",
        target: "components/audio-ui/devices/exciter/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "exciter-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "An exciter on the Web Audio API for an exciter state: the exciter of @audio/effect-exciter in an AudioWorklet loaded from a blob, the sound passing clean until it is ready.",
    files: [
      {
        path: "devices/exciter/engine.ts",
        target: "components/audio-ui/devices/exciter/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "exciter-engine",
    registryDependencies: ["@audio-ui/exciter-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the exciter device: the band of highs it makes its harmonics from, over the device knobs.",
    files: [
      {
        path: "devices/exciter/panel.tsx",
        target: "components/audio-ui/devices/exciter/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "exciter-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/exciter-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/effect-subbass"],
    description:
      "The bass enhancer as a device: a frequency, a drive, an amount and the share of the sub kept, the numbers that go on the worklet for a state, its two bands and the worklet's source (the bass enhancer of @audio/effect-subbass), with no panel and no audio in it.",
    files: [
      {
        path: "devices/bass-enhancer/device.ts",
        target: "components/audio-ui/devices/bass-enhancer/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/bass-enhancer/kernels.ts",
        target: "components/audio-ui/devices/bass-enhancer/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "bass-enhancer-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A bass enhancer on the Web Audio API for a bass enhancer state: the bass enhancer of @audio/effect-subbass in an AudioWorklet loaded from a blob, the sound passing clean until it is ready.",
    files: [
      {
        path: "devices/bass-enhancer/engine.ts",
        target: "components/audio-ui/devices/bass-enhancer/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "bass-enhancer-engine",
    registryDependencies: ["@audio-ui/bass-enhancer-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the bass enhancer device: the sub it takes, dashed, and the band its harmonics go to, over the device knobs.",
    files: [
      {
        path: "devices/bass-enhancer/panel.tsx",
        target: "components/audio-ui/devices/bass-enhancer/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "bass-enhancer-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/bass-enhancer-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/effect-rotary"],
    description:
      "The rotary speaker as a device: a speed (slow, fast or stop), a crossover, a depth, the horn's and the drum's ramps, a width and a mix, the numbers that go on the worklet for a state, its two bands and the worklet's source (the rotary of @audio/effect-rotary, with the crossover it splits the sound with), with no panel and no audio in it.",
    files: [
      {
        path: "devices/rotary/device.ts",
        target: "components/audio-ui/devices/rotary/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/rotary/kernels.ts",
        target: "components/audio-ui/devices/rotary/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "rotary-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A rotary speaker on the Web Audio API for a rotary state: the rotary of @audio/effect-rotary in an AudioWorklet loaded from a blob, a mono cabinet heard in stereo, the sound passing clean until it is ready.",
    files: [
      {
        path: "devices/rotary/engine.ts",
        target: "components/audio-ui/devices/rotary/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "rotary-engine",
    registryDependencies: ["@audio-ui/rotary-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the rotary device: the drum's band and the horn's, split at the crossover, over its speed and the device knobs.",
    files: [
      {
        path: "devices/rotary/panel.tsx",
        target: "components/audio-ui/devices/rotary/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "rotary-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/rotary-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/effect-stutter"],
    description:
      "The stutter as a device: an interval and a slice in note values, a decay and a mix, the numbers that go on the worklet for a state at a tempo, one interval as the panel draws it and the worklet's source (the stutter of @audio/effect-stutter), with no panel and no audio in it.",
    files: [
      {
        path: "devices/stutter/device.ts",
        target: "components/audio-ui/devices/stutter/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/stutter/kernels.ts",
        target: "components/audio-ui/devices/stutter/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "stutter-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A stutter on the Web Audio API for a stutter state: the stutter of @audio/effect-stutter in an AudioWorklet loaded from a blob, its lengths read against the host's tempo, a fresh cycle when it is turned on, the sound passing clean until it is ready.",
    files: [
      {
        path: "devices/stutter/engine.ts",
        target: "components/audio-ui/devices/stutter/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "stutter-engine",
    registryDependencies: ["@audio-ui/stutter-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the stutter device: one interval in beats, the slice it catches and its repeats at the level the decay leaves, over the device knobs.",
    files: [
      {
        path: "devices/stutter/panel.tsx",
        target: "components/audio-ui/devices/stutter/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "stutter-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/stutter-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/spatial-binaural"],
    description:
      "The binaural panner as a device: a direction, a distance, a head's size and a mix, the numbers that go on the worklet for a state, where it sits on the panel's top view and the worklet's source (the binaural panner of @audio/spatial-binaural), with no panel and no audio in it.",
    files: [
      {
        path: "devices/binaural-panner/device.ts",
        target: "components/audio-ui/devices/binaural-panner/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/binaural-panner/kernels.ts",
        target: "components/audio-ui/devices/binaural-panner/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "binaural-panner-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A binaural panner on the Web Audio API for a binaural panner state: the binaural panner of @audio/spatial-binaural in an AudioWorklet loaded from a blob, a turn across the back the short way round, the sound passing clean until it is ready.",
    files: [
      {
        path: "devices/binaural-panner/engine.ts",
        target: "components/audio-ui/devices/binaural-panner/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "binaural-panner-engine",
    registryDependencies: ["@audio-ui/binaural-panner-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the binaural panner device: the head seen from above and a handle for the sound around it, its direction and its distance, over the device knobs.",
    files: [
      {
        path: "devices/binaural-panner/panel.tsx",
        target: "components/audio-ui/devices/binaural-panner/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "binaural-panner-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/binaural-panner-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [
      "@audio-ui/core",
      "@audio/effect-bitcrusher",
      "@audio/effect-noiseshaper",
    ],
    description:
      "The redux as a device: a number of bits rounded to the nearest level or shaped, a downsample factor and a mix, the numbers that go on the nodes for a state, the stairs of the quantizer and the source of the worklet that holds and shapes, with no panel and no audio in it.",
    files: [
      {
        path: "devices/redux/device.ts",
        target: "components/audio-ui/devices/redux/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/redux/kernels.ts",
        target: "components/audio-ui/devices/redux/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "redux-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A redux on the Web Audio API for a redux state: a sample hold in an AudioWorklet loaded from a blob, which also shapes the bits, and a quantizer table that rounds them to the nearest level, mixed with the clean sound; the bits are crushed at once and the hold joins when the worklet is ready.",
    files: [
      {
        path: "devices/redux/engine.ts",
        target: "components/audio-ui/devices/redux/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "redux-engine",
    registryDependencies: ["@audio-ui/redux-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the redux device: the stairs the bits make against the straight line of a clean sound, over the device knobs.",
    files: [
      {
        path: "devices/redux/panel.tsx",
        target: "components/audio-ui/devices/redux/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "redux-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/redux-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [
      "@audio-ui/core",
      "@audio/reverb-dattorro",
      "@audio/reverb-fdn",
      "@audio/reverb-freeverb",
      "@audio/reverb-schroeder",
      "@audio/reverb-spring",
    ],
    description:
      "The reverb as a device: its type (a room, a plate, a hall, a spring, a Freeverb or a Schroeder), decay, pre-delay, damping and mix, the numbers that go on the nodes for a state, the decay a state draws and the impulse response of its room, with no panel and no audio in it.",
    files: [
      {
        path: "devices/reverb/device.ts",
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
      "A reverb on the Web Audio API for a reverb state: a convolver fed a room made from the type, the decay and the damping, two of them cross-faded so a new room never clicks, after a pre-delay and mixed with the dry sound.",
    files: [
      {
        path: "devices/reverb/engine.ts",
        target: "components/audio-ui/devices/reverb/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "reverb-engine",
    registryDependencies: ["@audio-ui/reverb-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the reverb device: the tail it makes, its level falling to -60 dB, with a handle where it ends to drag the decay time, over the device knobs.",
    files: [
      {
        path: "devices/reverb/panel.tsx",
        target: "components/audio-ui/devices/reverb/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "reverb-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/reverb-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "pad"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Sampler as an instrument device: one of two samples cut into sixteen slices, a key or a pad each from note 36, a low-pass filter, a pitch, a release and a gate, and no panel and no audio in it.",
    files: [
      {
        path: "devices/sampler/device.ts",
        target: "components/audio-ui/devices/sampler/device.ts",
        type: "registry:lib",
      },
    ],
    name: "sampler-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "pad"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the Sampler on the Web Audio API, with the two samples it comes with rendered once and shared: noteOn plays the slice its pitch picks, to its end, or cuts the playing one and plays anew; with the gate on, noteOff closes it over the release; load plays a file of your own. A host plays several slices at once with several.",
    files: [
      {
        path: "devices/sampler/engine.ts",
        target: "components/audio-ui/devices/sampler/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "sampler-engine",
    registryDependencies: ["@audio-ui/sampler-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "pad", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the Sampler device: its sample in its title bar, its controls and sixteen pads, one a slice, that play it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/sampler/panel.tsx",
        target: "components/audio-ui/devices/sampler/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "sampler-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/pad",
      "@audio-ui/sampler-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The saturator as a device: a curve, a drive, a mix and an output level, the numbers that go on the nodes for a state, the four curves and the transfer curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "devices/saturator/device.ts",
        target: "components/audio-ui/devices/saturator/device.ts",
        type: "registry:lib",
      },
    ],
    name: "saturator-device",
    registryDependencies: ["@audio-ui/oversampling"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A saturator on the Web Audio API for a saturator state: a drive gain into the table of the chosen curve at 4x oversampling, mixed with the clean sound at an output level; the table is rebuilt only when the curve changes.",
    files: [
      {
        path: "devices/saturator/engine.ts",
        target: "components/audio-ui/devices/saturator/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "saturator-engine",
    registryDependencies: [
      "@audio-ui/saturator-device",
      "@audio-ui/oversampling",
    ],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the saturator device: its transfer curve against the straight line of a clean sound, over the device knobs and the choice of curve.",
    files: [
      {
        path: "devices/saturator/panel.tsx",
        target: "components/audio-ui/devices/saturator/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "saturator-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/curve-select",
      "@audio-ui/plot",
      "@audio-ui/saturator-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The String Machine as an instrument device: a violin, a viola, a cello and a bass register, a brightness filter, an attack, a release and an ensemble, with eight presets, and no panel and no audio in it.",
    files: [
      {
        path: "devices/string-machine/device.ts",
        target: "components/audio-ui/devices/string-machine/device.ts",
        type: "registry:lib",
      },
    ],
    name: "string-machine-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the String Machine on the Web Audio API: four registers into a brightness filter, bowed in and out from where it got to, through an ensemble; noteOn bows a note, or cuts the held one and bows anew, noteOff lets it go over the release, and the registers and the brightness move a held note. A host plays chords with several.",
    files: [
      {
        path: "devices/string-machine/engine.ts",
        target: "components/audio-ui/devices/string-machine/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "string-machine-engine",
    registryDependencies: ["@audio-ui/string-machine-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the String Machine device: its eight presets, its controls by what they do (registers, tone, bow and output) and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/string-machine/panel.tsx",
        target: "components/audio-ui/devices/string-machine/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "string-machine-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/piano",
      "@audio-ui/string-machine-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "Tape Keys as an instrument device: 35 keys, each a strip of tape with one note on it, on three tracks (flutes, strings and a choir), the tape's speed, wow and flutter, and a tone, and no panel and no audio in it.",
    files: [
      {
        path: "devices/tape-keys/device.ts",
        target: "components/audio-ui/devices/tape-keys/device.ts",
        type: "registry:lib",
      },
    ],
    name: "tape-keys-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One key of Tape Keys on the Web Audio API: its tape runs on the track chosen for eight seconds at most, a little off in pitch and level, with hiss, wow and flutter, through saturation and a tone; noteOn runs a key, or cuts the held one and runs anew, noteOff lets the tape go at once, and the speed, wow and tone move a held key. A host plays chords with several.",
    files: [
      {
        path: "devices/tape-keys/engine.ts",
        target: "components/audio-ui/devices/tape-keys/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "tape-keys-engine",
    registryDependencies: ["@audio-ui/tape-keys-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "piano"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the Tape Keys device: the track its heads read in its title bar, the tape's speed, wow and tone, the volume, and its 35 keys. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/tape-keys/panel.tsx",
        target: "components/audio-ui/devices/tape-keys/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "tape-keys-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/piano",
      "@audio-ui/tape-keys-device",
      "@shadcn/toggle-group",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core", "@audio/dynamics-transient-shaper"],
    description:
      "The transient shaper as a device: an attack and a sustain, each up or down by 12 dB, and an output gain, its models (clean, or the follower of @audio/dynamics-transient-shaper), the numbers that go on the nodes for a state and the sources of the detector's and the follower's worklets, with no panel and no audio in it.",
    files: [
      {
        path: "devices/transient/device.ts",
        target: "components/audio-ui/devices/transient/device.ts",
        type: "registry:lib",
      },
      {
        path: "devices/transient/kernels.ts",
        target: "components/audio-ui/devices/transient/kernels.ts",
        type: "registry:lib",
      },
    ],
    name: "transient-device",
    registryDependencies: ["@audio-ui/manifest-worklet"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "A transient shaper on the Web Audio API for a transient state: a worklet detector reads the shape of the envelope and writes the gain, and the audio waits a millisecond for it so the attack is shaped from its first sample, or the follower model in a worklet fed only while it plays.",
    files: [
      {
        path: "devices/transient/engine.ts",
        target: "components/audio-ui/devices/transient/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "transient-engine",
    registryDependencies: ["@audio-ui/transient-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the transient shaper device: the model picked in its title bar, a square with the sustain across and the attack up, and a handle to drag to both at once, over the output knob.",
    files: [
      {
        path: "devices/transient/panel.tsx",
        target: "components/audio-ui/devices/transient/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "transient-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/transient-device",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The utility as a device: a gain, a pan, a stereo width, a mono switch and a phase invert, the numbers that go on the nodes for a state, with no panel and no audio in it.",
    files: [
      {
        path: "devices/utility/device.ts",
        target: "components/audio-ui/devices/utility/device.ts",
        type: "registry:lib",
      },
    ],
    name: "utility-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A utility on the Web Audio API for a utility state: the signal split into mid and side, the side scaled by the width, then a pan and a gain with an optional phase invert, moving without a click.",
    files: [
      {
        path: "devices/utility/engine.ts",
        target: "components/audio-ui/devices/utility/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "utility-engine",
    registryDependencies: ["@audio-ui/utility-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the utility device: its gain, pan and width as knobs and its mono and invert switches.",
    files: [
      {
        path: "devices/utility/panel.tsx",
        target: "components/audio-ui/devices/utility/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "utility-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/utility-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "modulation"],
    dependencies: ["@audio-ui/core"],
    description:
      "The vibe as a device: a lamp that pulses on four phase-shift stages spread wide apart, in chorus or vibrato, with its speed, intensity and level, the lamp's cycle and what it shows, and no panel and no audio in it.",
    files: [
      {
        path: "devices/vibe/device.ts",
        target: "components/audio-ui/devices/vibe/device.ts",
        type: "registry:lib",
      },
    ],
    name: "vibe-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "modulation"],
    dependencies: ["@audio-ui/core"],
    description:
      "The vibe on the Web Audio API: a warm preamp, four all-pass stages swept by an oscillator of the lamp's own wave, mixed half dry in chorus or alone in vibrato, and a bypass when it is off.",
    files: [
      {
        path: "devices/vibe/engine.ts",
        target: "components/audio-ui/devices/vibe/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "vibe-engine",
    registryDependencies: ["@audio-ui/vibe-device"],
    type: "registry:lib",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the vibe device: the lamp's light over two seconds, rising fast and fading slowly, over its mode and its knobs.",
    files: [
      {
        path: "devices/vibe/panel.tsx",
        target: "components/audio-ui/devices/vibe/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "vibe-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/vibe-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Wave Shaper as an instrument device: its waveform, drive, tone, detune, mix and volume, the pitch and resonance a pad position plays, and the distortion curve, with no panel and no audio in it.",
    files: [
      {
        path: "devices/wave-shaper/device.ts",
        target: "components/audio-ui/devices/wave-shaper/device.ts",
        type: "registry:lib",
      },
    ],
    name: "wave-shaper-device",
    registryDependencies: ["@audio-ui/oversampling"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "A wave shaper synth on the Web Audio API for a Wave Shaper state: two detuned oscillators, a distortion mixed in parallel and a low-pass filter; noteOn starts a note or glides the held one, noteOff releases it.",
    files: [
      {
        path: "devices/wave-shaper/engine.ts",
        target: "components/audio-ui/devices/wave-shaper/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "wave-shaper-engine",
    registryDependencies: [
      "@audio-ui/wave-shaper-device",
      "@audio-ui/oversampling",
    ],
    type: "registry:lib",
  },
  {
    categories: ["device", "synth", "xypad"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the Wave Shaper device: a pad that plays it, its waveform and its knobs. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "devices/wave-shaper/panel.tsx",
        target: "components/audio-ui/devices/wave-shaper/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "wave-shaper-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/waveform-select",
      "@audio-ui/xypad",
      "@audio-ui/wave-shaper-device",
    ],
    type: "registry:ui",
  },
  ...installs,
];
