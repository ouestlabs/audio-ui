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
      "A compressor on the Web Audio API for a compressor state: the node, its make-up taken back out or kept, a dry and compressed mix aligned to the node's lookahead, parameters that move without a click, and a key: a worklet detector that ducks the signal from another one.",
    files: [
      {
        path: "lib/compressor-engine.ts",
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
        path: "lib/wave-shaper-engine.ts",
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
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The distortion as a device: a drive, a tone, a mix and an output level, the numbers that go on the nodes for a state, the soft clip and the transfer curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/distortion-device.ts",
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
      "A distortion on the Web Audio API for a distortion state: a drive gain into a fixed soft-clip table at 4x oversampling, a tone filter, mixed with the clean sound at an output level, moving without a click.",
    files: [
      {
        path: "lib/distortion-engine.ts",
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
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The chorus as a device: a rate, a depth, a delay and a mix, the numbers that go on the nodes for a state and the sweep of the delay time, with no panel and no audio in it.",
    files: [
      {
        path: "lib/chorus-device.ts",
        target: "components/audio-ui/devices/chorus/device.ts",
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
      "A chorus on the Web Audio API for a chorus state: a short delay whose time an oscillator sweeps, mixed with the dry sound, moving without a click.",
    files: [
      {
        path: "lib/chorus-engine.ts",
        target: "components/audio-ui/devices/chorus/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "chorus-engine",
    registryDependencies: ["@audio-ui/chorus-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The utility as a device: a gain, a pan, a stereo width, a mono switch and a phase invert, the numbers that go on the nodes for a state, with no panel and no audio in it.",
    files: [
      {
        path: "lib/utility-device.ts",
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
        path: "lib/utility-engine.ts",
        target: "components/audio-ui/devices/utility/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "utility-engine",
    registryDependencies: ["@audio-ui/utility-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The limiter as a device: an input gain, a ceiling and a release, the numbers that go on the nodes for a state and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/limiter-device.ts",
        target: "components/audio-ui/devices/limiter/device.ts",
        type: "registry:lib",
      },
    ],
    name: "limiter-device",
    registryDependencies: ["@audio-ui/oversampling"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A limiter on the Web Audio API for a limiter state: the browser compressor node at a ratio of 20 with no knee, its make-up taken back out, the signal going round it when it is off.",
    files: [
      {
        path: "lib/limiter-engine.ts",
        target: "components/audio-ui/devices/limiter/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "limiter-engine",
    registryDependencies: ["@audio-ui/limiter-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The gate as a device: a threshold, a floor, an attack, a hold, a release and a look-ahead, the numbers that go on the nodes for a state, the detector worklet and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/gate-device.ts",
        target: "components/audio-ui/devices/gate/device.ts",
        type: "registry:lib",
      },
    ],
    name: "gate-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A gate on the Web Audio API for a gate state: a worklet detector reads the key and writes the gain (threshold, attack, hold, release), and a delay in front of the gain gives the look-ahead.",
    files: [
      {
        path: "lib/gate-engine.ts",
        target: "components/audio-ui/devices/gate/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "gate-engine",
    registryDependencies: ["@audio-ui/gate-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The saturator as a device: a curve, a drive, a mix and an output level, the numbers that go on the nodes for a state, the four curves and the transfer curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/saturator-device.ts",
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
        path: "lib/saturator-engine.ts",
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
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The phaser-flanger as a device: a mode, a rate, a depth, a centre frequency, a delay, a feedback and a mix, the numbers that go on the nodes for a state and the sweep, with no panel and no audio in it.",
    files: [
      {
        path: "lib/phaser-device.ts",
        target: "components/audio-ui/devices/phaser/device.ts",
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
      "A phaser and flanger on the Web Audio API for a phaser state: four all-pass filters and a short delay swept by one oscillator, crossfaded by the mode, with feedback and a mix.",
    files: [
      {
        path: "lib/phaser-engine.ts",
        target: "components/audio-ui/devices/phaser/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "phaser-engine",
    registryDependencies: ["@audio-ui/phaser-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The auto pan as a device: a mode, a waveform, a rate and a depth, the numbers that go on the nodes for a state and the movement the oscillator makes, with no panel and no audio in it.",
    files: [
      {
        path: "lib/auto-pan-device.ts",
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
        path: "lib/auto-pan-engine.ts",
        target: "components/audio-ui/devices/auto-pan/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "auto-pan-engine",
    registryDependencies: ["@audio-ui/auto-pan-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The channel EQ as a device: a low shelf, a sweepable mid bell, a high shelf, a high-pass switch and an output level, their filters as a state describes them and the curve a state plays, with no panel and no audio in it.",
    files: [
      {
        path: "lib/channel-eq-device.ts",
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
        path: "lib/channel-eq-engine.ts",
        target: "components/audio-ui/devices/channel-eq/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "channel-eq-engine",
    registryDependencies: ["@audio-ui/channel-eq-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The overdrive as a device: a band-pass before a soft clip with a drive, a tone and a mix, the numbers that go on the nodes for a state and the band that reaches the clip, with no panel and no audio in it.",
    files: [
      {
        path: "lib/overdrive-device.ts",
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
        path: "lib/overdrive-engine.ts",
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
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The de-esser as a device: a frequency, a threshold, a ratio and a range, the numbers that go on the nodes for a state, the table that keeps the highs above their floor and the response a state draws, with no panel and no audio in it.",
    files: [
      {
        path: "lib/deesser-device.ts",
        target: "components/audio-ui/devices/deesser/device.ts",
        type: "registry:lib",
      },
    ],
    name: "deesser-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "A de-esser on the Web Audio API for a de-esser state: a Linkwitz-Riley split at the frequency, the highs read by the compressor's detector and taken down over the threshold, never under the range, and added back to the lows.",
    files: [
      {
        path: "lib/deesser-engine.ts",
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
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "The detector of a key: an AudioWorklet loaded once per context from a blob, which reads a signal and writes the gain a compressor would apply to it. The compressor's key and the de-esser use it.",
    files: [
      {
        path: "lib/key-detector.ts",
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
      "The redux as a device: a number of bits, a downsample factor and a mix, the numbers that go on the nodes for a state, the stairs of the quantizer and the source of the sample-hold worklet, with no panel and no audio in it.",
    files: [
      {
        path: "lib/redux-device.ts",
        target: "components/audio-ui/devices/redux/device.ts",
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
      "A redux on the Web Audio API for a redux state: a sample hold in an AudioWorklet loaded from a blob and a quantizer table for the bits, mixed with the clean sound; the bits are crushed at once and the hold joins when the worklet is ready.",
    files: [
      {
        path: "lib/redux-engine.ts",
        target: "components/audio-ui/devices/redux/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "redux-engine",
    registryDependencies: ["@audio-ui/redux-device"],
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
      "Measure an engine against what its device claims, in an offline audio context: how far its frequency response is from the curve the panel draws, how long it delays a signal, and the helpers to render and read a signal. For a host that brings its own engine.",
    files: [
      {
        path: "lib/device-measure.ts",
        type: "registry:lib",
      },
    ],
    name: "device-measure",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "web-audio"],
    dependencies: [],
    description:
      "What a waveshaper that oversamples costs in time, and a delay that holds a dry path back by it, so a distortion mixed with its dry sound does not comb. Measured in Chrome.",
    files: [
      {
        path: "lib/oversampling.ts",
        type: "registry:lib",
      },
    ],
    name: "oversampling",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The rate of an oscillator that is either free, in hertz, or synced: one cycle per note value of the host's tempo. The two parameters a device adds for it, and the function that reads the rate.",
    files: [
      {
        path: "lib/synced-rate.ts",
        type: "registry:lib",
      },
    ],
    name: "synced-rate",
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
