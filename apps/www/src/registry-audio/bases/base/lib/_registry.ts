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
      "The Poly Synth as an instrument device: a saw, a pulse, a sub oscillator and noise, a resonant low-pass filter that follows the keyboard, an envelope for the filter and the level, a vibrato and a chorus, with eight presets, and no panel and no audio in it.",
    files: [
      {
        path: "lib/poly-synth-device.ts",
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
      "The Mono Synth as an instrument device: a saw, square or triangle oscillator, a sub oscillator and noise, a resonant low-pass filter an envelope opens, a range, a glide and a vibrato, with eight presets, and no panel and no audio in it.",
    files: [
      {
        path: "lib/mono-synth-device.ts",
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
      "The Organ as an instrument device: nine drawbars of sines at the organ's harmonics, a percussion on the second or third harmonic, a key click, a drive and a rotary speaker, with six registrations, and no panel and no audio in it.",
    files: [
      {
        path: "lib/organ-device.ts",
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
      "The String Machine as an instrument device: a violin, a viola, a cello and a bass register, a brightness filter, an attack, a release and an ensemble, with eight presets, and no panel and no audio in it.",
    files: [
      {
        path: "lib/string-machine-device.ts",
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
      "Tape Keys as an instrument device: 35 keys, each a strip of tape with one note on it, on three tracks (flutes, strings and a choir), the tape's speed, wow and flutter, and a tone, and no panel and no audio in it.",
    files: [
      {
        path: "lib/tape-keys-device.ts",
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
      "The FM Synth as an instrument device: four operators, each a ratio, a level, a decay and a sustain, eight algorithms that wire them, feedback, an attack, a release and a vibrato, with eight presets, and no panel and no audio in it.",
    files: [
      {
        path: "lib/fm-synth-device.ts",
        target: "components/audio-ui/devices/fm-synth/device.ts",
        type: "registry:lib",
      },
    ],
    name: "fm-synth-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "pad"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Sampler as an instrument device: one of two samples cut into sixteen slices, a key or a pad each from note 36, a low-pass filter, a pitch, a release and a gate, and no panel and no audio in it.",
    files: [
      {
        path: "lib/sampler-device.ts",
        target: "components/audio-ui/devices/sampler/device.ts",
        type: "registry:lib",
      },
    ],
    name: "sampler-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Electric Piano as an instrument device: a tine's body that barks and a bell that pings, rung down by itself, a pickup's drive and a tremolo, with four presets, and no panel and no audio in it.",
    files: [
      {
        path: "lib/electric-piano-device.ts",
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
      "One voice of the Poly Synth on the Web Audio API: noteOn starts a note or glides the held one, noteOff releases it from where its envelope got to, and every control follows the state without a click. A host plays chords with several.",
    files: [
      {
        path: "lib/poly-synth-engine.ts",
        target: "components/audio-ui/devices/poly-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "poly-synth-engine",
    registryDependencies: ["@audio-ui/poly-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "The Mono Synth on the Web Audio API, the whole synth in one engine: it takes every note by its id, the first opens the envelope, a note while one is held glides to it, and letting go of it glides back to the one still held. Every control moves a held note.",
    files: [
      {
        path: "lib/mono-synth-engine.ts",
        target: "components/audio-ui/devices/mono-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "mono-synth-engine",
    registryDependencies: ["@audio-ui/mono-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One key of the Organ on the Web Audio API: nine sines at the drawbars' levels, with the percussion and the click, through a drive and a rotary speaker; noteOn sounds a key at once, or cuts the held one and sounds anew, noteOff stops it at once, and the drawbars move a held key. A host plays chords with several.",
    files: [
      {
        path: "lib/organ-engine.ts",
        target: "components/audio-ui/devices/organ/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "organ-engine",
    registryDependencies: ["@audio-ui/organ-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the String Machine on the Web Audio API: four registers into a brightness filter, bowed in and out from where it got to, through an ensemble; noteOn bows a note, or cuts the held one and bows anew, noteOff lets it go over the release, and the registers and the brightness move a held note. A host plays chords with several.",
    files: [
      {
        path: "lib/string-machine-engine.ts",
        target: "components/audio-ui/devices/string-machine/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "string-machine-engine",
    registryDependencies: ["@audio-ui/string-machine-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One key of Tape Keys on the Web Audio API: its tape runs on the track chosen for eight seconds at most, a little off in pitch and level, with hiss, wow and flutter, through saturation and a tone; noteOn runs a key, or cuts the held one and runs anew, noteOff lets the tape go at once, and the speed, wow and tone move a held key. A host plays chords with several.",
    files: [
      {
        path: "lib/tape-keys-engine.ts",
        target: "components/audio-ui/devices/tape-keys/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "tape-keys-engine",
    registryDependencies: ["@audio-ui/tape-keys-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the FM Synth on the Web Audio API: four operators wired by the algorithm, each with its envelope; noteOn strikes a note, or cuts the held one and strikes anew, noteOff releases every operator from where it got to, and the levels, ratios, feedback and vibrato move a held note. A host plays chords with several.",
    files: [
      {
        path: "lib/fm-synth-engine.ts",
        target: "components/audio-ui/devices/fm-synth/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "fm-synth-engine",
    registryDependencies: ["@audio-ui/fm-synth-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "pad"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the Sampler on the Web Audio API, with the two samples it comes with rendered once and shared: noteOn plays the slice its pitch picks, to its end, or cuts the playing one and plays anew; with the gate on, noteOff closes it over the release; load plays a file of your own. A host plays several slices at once with several.",
    files: [
      {
        path: "lib/sampler-engine.ts",
        target: "components/audio-ui/devices/sampler/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "sampler-engine",
    registryDependencies: ["@audio-ui/sampler-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "One voice of the Electric Piano on the Web Audio API: noteOn strikes a note, which rings down by itself, or cuts the ringing one and strikes anew; noteOff lets it fall silent from where it got to; the drive, the tremolo and the volume follow the state without a click. A host plays chords with several.",
    files: [
      {
        path: "lib/electric-piano-engine.ts",
        target: "components/audio-ui/devices/electric-piano/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "electric-piano-engine",
    registryDependencies: ["@audio-ui/electric-piano-device"],
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
    categories: ["lib", "audio", "device", "modulation"],
    dependencies: ["@audio-ui/core"],
    description:
      "The vibe as a device: a lamp that pulses on four phase-shift stages spread wide apart, in chorus or vibrato, with its speed, intensity and level, the lamp's cycle and what it shows, and no panel and no audio in it.",
    files: [
      {
        path: "lib/vibe-device.ts",
        target: "components/audio-ui/devices/vibe/device.ts",
        type: "registry:lib",
      },
    ],
    name: "vibe-device",
    registryDependencies: [],
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
    categories: ["lib", "audio", "device", "modulation"],
    dependencies: ["@audio-ui/core"],
    description:
      "The vibe on the Web Audio API: a warm preamp, four all-pass stages swept by an oscillator of the lamp's own wave, mixed half dry in chorus or alone in vibrato, and a bypass when it is off.",
    files: [
      {
        path: "lib/vibe-engine.ts",
        target: "components/audio-ui/devices/vibe/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "vibe-engine",
    registryDependencies: ["@audio-ui/vibe-device"],
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
    dependencies: ["@audio-ui/core"],
    description:
      "The multiband compressor as a device: two splits and a threshold and ratio for each of the three bands, with an attack, a release and an output gain, the numbers that go on the nodes for a state and the bands a state draws, with no panel and no audio in it.",
    files: [
      {
        path: "lib/multiband-device.ts",
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
        path: "lib/multiband-engine.ts",
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
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The transient shaper as a device: an attack and a sustain, each up or down by 12 dB, and an output gain, the numbers that go on the nodes for a state and the source of the detector worklet, with no panel and no audio in it.",
    files: [
      {
        path: "lib/transient-device.ts",
        target: "components/audio-ui/devices/transient/device.ts",
        type: "registry:lib",
      },
    ],
    name: "transient-device",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "A transient shaper on the Web Audio API for a transient state: a worklet detector reads the shape of the envelope and writes the gain, and the audio waits a millisecond for it so the attack is shaped from its first sample.",
    files: [
      {
        path: "lib/transient-engine.ts",
        target: "components/audio-ui/devices/transient/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "transient-engine",
    registryDependencies: ["@audio-ui/transient-device"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The mid/side device as a device: a level for the mid, a level for the side and a bass mono frequency, the numbers that go on the nodes for a state, with no panel and no audio in it.",
    files: [
      {
        path: "lib/mid-side-device.ts",
        target: "components/audio-ui/devices/mid-side/device.ts",
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
      "A mid/side device on the Web Audio API for a mid/side state: the signal split into mid and side, a level for each, a high-pass on the side for bass mono, and the two added back, moving without a click.",
    files: [
      {
        path: "lib/mid-side-engine.ts",
        target: "components/audio-ui/devices/mid-side/engine.ts",
        type: "registry:lib",
      },
    ],
    name: "mid-side-engine",
    registryDependencies: ["@audio-ui/mid-side-device"],
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
    dependencies: ["@audio-ui/core"],
    description:
      "The sounds the previews play, by name: Boom bap and Drone, with the kick that goes with the first. Drawn once in code and looped as a buffer, no samples.",
    files: [
      {
        path: "lib/demo-sound.ts",
        type: "registry:lib",
      },
    ],
    name: "demo-sound",
    registryDependencies: ["@audio-ui/drum-synthesis"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "A chill two-bar song at 80 BPM on E minor seven, G and A: a strummed guitar (a plucked-string model) and drums drawn as recordings, and an organ and a bass as notes for MIDI tracks. What the arrangement's demo plays.",
    files: [
      {
        path: "lib/demo-song.ts",
        type: "registry:lib",
      },
    ],
    name: "demo-song",
    registryDependencies: [],
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
    dependencies: ["@audio-ui/core", "@audio-ui/react"],
    description:
      "The document of an arrangement of clips on tracks: its clips, tracks and mixes, how far a clip reaches, where a MIDI clip's notes play, and what a track's volume and pan automation gives at a point of the song",
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
    categories: ["lib", "piano"],
    dependencies: ["@audio-ui/core"],
    description:
      "MIDI files to and from notes on a grid of steps: read one, with its tempo, write one, or download one",
    files: [
      {
        path: "lib/midi-file.ts",
        type: "registry:lib",
      },
    ],
    name: "midi-file",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "Racks: devices in parallel chains, each with its volume, pan, switch and solo, lined up on the slowest and summed, and eight macros that turn parameters of the devices inside over a stretch of their travel; the engine that plays one on a track's chain.",
    files: [
      {
        path: "lib/rack.ts",
        type: "registry:lib",
      },
    ],
    name: "rack",
    registryDependencies: ["@audio-ui/arrangement", "@audio-ui/device-library"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "Drum racks: an instrument whose chains are pads, each answering a note with a voice of the drum synthesis or a recording, pitched and cut to a decay, into its own devices; the engine that plays one on a MIDI track.",
    files: [
      {
        path: "lib/drum-rack.ts",
        type: "registry:lib",
      },
    ],
    name: "drum-rack",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/drum-synthesis",
      "@audio-ui/rack",
      "@audio-ui/voice-pool",
    ],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "Note players: what a MIDI track plays through, all taking notes the same way, and the voice pool that plays an instrument of the library with a voice for each note it holds, the oldest given up first.",
    files: [
      {
        path: "lib/voice-pool.ts",
        type: "registry:lib",
      },
    ],
    name: "voice-pool",
    registryDependencies: ["@audio-ui/device-library"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "Instrument racks: an instrument whose chains each start with an instrument of the library, then effects, all played by every note in layers and summed as a rack with its macros; the engine that plays one on a MIDI track.",
    files: [
      {
        path: "lib/instrument-rack.ts",
        type: "registry:lib",
      },
    ],
    name: "instrument-rack",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/device-library",
      "@audio-ui/rack",
      "@audio-ui/voice-pool",
    ],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "An arrangement to and from DAWproject, the open exchange format other DAWs read and write: tracks, returns and the main track with their mix and sends, audio clips with fades, loop and warp, MIDI clips, volume and pan automation, locators, tempo and time signatures, and the equalizer, compressor, gate and limiter; a report says what was left out. With the zip archives it is packed in.",
    files: [
      {
        path: "lib/dawproject.ts",
        type: "registry:lib",
      },
      {
        path: "lib/zip.ts",
        type: "registry:lib",
      },
    ],
    name: "dawproject",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
      "@audio-ui/compressor-device",
      "@audio-ui/equalizer-device",
      "@audio-ui/gate-device",
      "@audio-ui/limiter-device",
    ],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio"],
    description:
      "WAV files from rendered sound: 16 or 24-bit PCM, normalized or not, encoded to bytes or downloaded",
    files: [
      {
        path: "lib/wav-file.ts",
        type: "registry:lib",
      },
    ],
    name: "wav-file",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "timeline"],
    dependencies: ["@audio-ui/core"],
    description:
      "Recording into an arrangement: an input recorder on an AudioWorklet that keeps each block with its frame on the audio clock, the frames of a take with the latency taken off, and the audio or MIDI clip a take becomes, with record quantization and overdub",
    files: [
      {
        path: "lib/recording.ts",
        type: "registry:lib",
      },
      {
        path: "lib/input-recorder.ts",
        type: "registry:lib",
      },
    ],
    name: "recording",
    registryDependencies: ["@audio-ui/arrangement"],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "timeline"],
    dependencies: ["@audio-ui/core"],
    description:
      "A track's player of audio clips on an AudioWorklet: its recordings to the frame on the audio clock, with gain, fades, loops, reverse and warp, in a running or an offline context",
    files: [
      {
        path: "lib/clip-player.ts",
        type: "registry:lib",
      },
    ],
    name: "clip-player",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "Every device of the registry with its engine, by shelf: what a host needs to build a track's chain from the ids a project stores, and what a device browser lists",
    files: [
      {
        path: "lib/device-library.ts",
        type: "registry:lib",
      },
    ],
    name: "device-library",
    registryDependencies: [
      "@audio-ui/auto-pan-device",
      "@audio-ui/auto-pan-engine",
      "@audio-ui/channel-eq-device",
      "@audio-ui/channel-eq-engine",
      "@audio-ui/chorus-device",
      "@audio-ui/chorus-engine",
      "@audio-ui/compressor-device",
      "@audio-ui/compressor-engine",
      "@audio-ui/deesser-device",
      "@audio-ui/deesser-engine",
      "@audio-ui/delay-device",
      "@audio-ui/delay-engine",
      "@audio-ui/distortion-device",
      "@audio-ui/distortion-engine",
      "@audio-ui/equalizer-device",
      "@audio-ui/equalizer-engine",
      "@audio-ui/filter-device",
      "@audio-ui/filter-engine",
      "@audio-ui/gate-device",
      "@audio-ui/gate-engine",
      "@audio-ui/limiter-device",
      "@audio-ui/limiter-engine",
      "@audio-ui/mid-side-device",
      "@audio-ui/mid-side-engine",
      "@audio-ui/multiband-device",
      "@audio-ui/multiband-engine",
      "@audio-ui/overdrive-device",
      "@audio-ui/overdrive-engine",
      "@audio-ui/phaser-device",
      "@audio-ui/phaser-engine",
      "@audio-ui/vibe-device",
      "@audio-ui/vibe-engine",
      "@audio-ui/pocket-synth-device",
      "@audio-ui/pocket-synth-engine",
      "@audio-ui/poly-synth-device",
      "@audio-ui/poly-synth-engine",
      "@audio-ui/fm-synth-device",
      "@audio-ui/fm-synth-engine",
      "@audio-ui/mono-synth-device",
      "@audio-ui/mono-synth-engine",
      "@audio-ui/organ-device",
      "@audio-ui/organ-engine",
      "@audio-ui/string-machine-device",
      "@audio-ui/string-machine-engine",
      "@audio-ui/tape-keys-device",
      "@audio-ui/tape-keys-engine",
      "@audio-ui/sampler-device",
      "@audio-ui/sampler-engine",
      "@audio-ui/electric-piano-device",
      "@audio-ui/electric-piano-engine",
      "@audio-ui/redux-device",
      "@audio-ui/redux-engine",
      "@audio-ui/reverb-device",
      "@audio-ui/reverb-engine",
      "@audio-ui/saturator-device",
      "@audio-ui/saturator-engine",
      "@audio-ui/transient-device",
      "@audio-ui/transient-engine",
      "@audio-ui/utility-device",
      "@audio-ui/utility-engine",
      "@audio-ui/wave-shaper-device",
      "@audio-ui/wave-shaper-engine",
    ],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "mixer"],
    dependencies: ["@audio-ui/core"],
    description:
      "A mixer on the Web Audio API: a channel per track and return, with its chain, volume, constant-power pan, switch, solo, pre or post-fader sends, delay compensation and meters, into a main track",
    files: [
      {
        path: "lib/mixer-engine.ts",
        type: "registry:lib",
      },
    ],
    name: "mixer-engine",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "timeline", "mixer"],
    dependencies: ["@audio-ui/core", "@audio-ui/react"],
    description:
      "Plays an arrangement on the audio clock: its audio clips, its notes through each track's instrument, its device chains, sends and returns, and an offline render to a buffer, with a hook for the transport, the playhead and the meters",
    files: [
      {
        path: "lib/arrangement-engine.ts",
        type: "registry:lib",
      },
      {
        path: "hooks/use-arrangement-engine.ts",
        type: "registry:hook",
      },
    ],
    name: "arrangement-engine",
    registryDependencies: [
      "@audio-ui/drum-synthesis",
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
      "@audio-ui/clip-player",
      "@audio-ui/device-library",
      "@audio-ui/mixer-engine",
      "@audio-ui/rack",
      "@audio-ui/drum-rack",
      "@audio-ui/instrument-rack",
      "@audio-ui/voice-pool",
      "@audio-ui/web-audio",
    ],
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
  {
    categories: ["lib", "audio"],
    description:
      "The gesture of reordering a row by dragging one of its items: the others slide aside, the item shows dimmed where it would land, what follows the pointer settles there, the view scrolls at its edges. No render while it moves.",
    files: [
      {
        path: "lib/sortable-drag.ts",
        type: "registry:lib",
      },
    ],
    name: "sortable-drag",
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
