import type { RegistryItem } from "shadcn/schema";
import { deviceItems } from "../../items";

/**
 * The devices, each installed in one: its state, its engine and its panel,
 * to `components/audio-ui/devices/<name>/`. Each piece stays an item of its
 * own, for a panel over an engine of your own or an engine with no panel.
 * `deviceItems` makes the four items of a device from one description.
 */
export const devices: RegistryItem[] = [
  {
    categories: ["lib", "audio", "device"],
    dependencies: [],
    description:
      "The detector of a key: an AudioWorklet loaded once per context from a blob, which reads a signal and writes the gain a compressor would apply to it. The multiband compressor uses it.",
    files: [
      {
        path: "devices/key-detector.ts",
        target: "components/audio-ui/devices/key-detector.ts",
        type: "registry:lib",
      },
    ],
    name: "key-detector",
    registryDependencies: ["@audio-ui/audio-worklet"],
    type: "registry:lib",
  },
  ...deviceItems("auto-pan", {
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The auto pan as a device: a mode, a waveform, a rate and a depth, the numbers that go on the nodes for a state and the movement the oscillator makes, with no panel and no audio in it.",
      registryDependencies: ["@audio-ui/synced-rate"],
    },
    engine: {
      description:
        "An auto pan and tremolo on the Web Audio API for an auto pan state: one oscillator that moves a stereo panner or the level of a gain, by the mode, at a rate, a depth and a waveform.",
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the auto pan device: what the oscillator does to the pan or the level over two seconds, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("binaural-panner", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/spatial-binaural"],
      description:
        "The binaural panner as a device: a direction, a distance, a head's size and a mix, the numbers that go on the worklet for a state, where it sits on the panel's top view and the worklet's source (the binaural panner of @audio/spatial-binaural), with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A binaural panner on the Web Audio API for a binaural panner state: the binaural panner of @audio/spatial-binaural in an AudioWorklet loaded from a blob, a turn across the back the short way round, the sound passing clean until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the binaural panner device: the head seen from above and a handle for the sound around it, its direction and its distance, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("bass-enhancer", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/effect-subbass"],
      description:
        "The bass enhancer as a device: a frequency, a drive, an amount and the share of the sub kept, the numbers that go on the worklet for a state, its two bands and the worklet's source (the bass enhancer of @audio/effect-subbass), with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A bass enhancer on the Web Audio API for a bass enhancer state: the bass enhancer of @audio/effect-subbass in an AudioWorklet loaded from a blob, the sound passing clean until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the bass enhancer device: the sub it takes, dashed, and the band its harmonics go to, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("channel-eq", {
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The channel EQ as a device: a low shelf, a sweepable mid bell, a high shelf, a high-pass switch and an output level, their filters as a state describes them and the curve a state plays, with no panel and no audio in it.",
    },
    engine: {
      description:
        "A channel EQ on the Web Audio API for a channel EQ state: a high-pass, a low shelf, a mid bell and a high shelf in series with an output trim, the same filters its curve draws, moving without a click.",
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the channel EQ device: the curve it plays with a handle on the mid band and an optional live spectrum, over the shelf knobs and the high-pass switch.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("chorus", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/effect-chorus"],
      description:
        "The chorus as a device: a rate, a depth, a delay, one to eight voices and a mix, the numbers that go on the nodes for a state, the sweep of each voice's delay time and the source of the voices' worklet (the chorus of @audio/effect-chorus), with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/synced-rate"],
    },
    engine: {
      description:
        "A chorus on the Web Audio API for a chorus state: a short delay whose time an oscillator sweeps, or two to eight voices in an AudioWorklet loaded from a blob, mixed with the dry sound, moving without a click.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the chorus device: the delay time of each voice as its oscillator sweeps it over two seconds, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("compander", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/dynamics-compand"],
      description:
        "The compander as a device: the level out at -90, -60, -20 and 0 dB in, an attack and a release, the numbers that go on the worklet for a state, the curve a state plays, measured from the package's own stream, and the worklet's source (the compander of @audio/dynamics-compand), with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/manifest-worklet"],
    },
    engine: {
      description:
        "A compander on the Web Audio API for a compander state: the compander of @audio/dynamics-compand in an AudioWorklet loaded from a blob, fed only while it plays, the sound passing unchanged until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the compander device: its transfer curve against the straight line of a clean sound, with a handle on each of its four points, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("compressor", {
    device: {
      dependencies: [
        "@audio-ui/core",
        "@audio/dynamics-compressor",
        "@audio/dynamics-fet",
        "@audio/dynamics-opto",
        "@audio/dynamics-varimu",
        "@audio/dynamics-vca",
      ],
      description:
        "The compressor as a device: its parameters and what they mean, its models (the smooth, VCA, FET, opto and vari-mu compressors of @audio/dynamics-*), the numbers that go on the nodes for a state, the curve a state plays and the source of the models' worklet, with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/manifest-worklet"],
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "A compressor on the Web Audio API for a compressor state: the audio.js models in a worklet, the make-up after it, a dry and compressed mix, parameters that move without a click, the signal passing until the worklet is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot"],
      description:
        "The face of the compressor device: the model picked in its title bar, the transfer curve it plays, with the threshold and the level going in on it, over the device's knobs, those a model does not use drawn off.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("deesser", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/dynamics-deesser"],
      description:
        "The de-esser as a device: a frequency, an over-body level, a ratio and a range, its models (the split, band and wide band de-essers of @audio/dynamics-deesser, which tell an s by the highs over the voice's body), the numbers that go on the worklet for a state, the response a state draws and the source of the worklet, with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/manifest-worklet"],
    },
    engine: {
      description:
        "A de-esser on the Web Audio API for a de-esser state: the audio.js de-esser in a worklet, the highs passing until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the de-esser device: the model picked in its title bar, what it does at each frequency with a handle at the frequency to drag across and up or down for the range, over the device knobs, those the model does not use drawn off.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("delay", {
    device: {
      dependencies: [
        "@audio-ui/core",
        "@audio/effect-graindelay",
        "@audio/effect-multitap",
        "@audio/effect-pingpong",
      ],
      description:
        "The delay as a device: its mode (an echo, a ping-pong, a multitap or a grain delay), time, feedback, tone and mix, and the grain delay's pitch, spray, jitter and grain size, the numbers that go on the nodes for a state, the echoes a state makes and the worklet's source, with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A delay on the Web Audio API for a delay state: an echo that goes round a tone filter so each repeat is darker, mixed with the dry sound, with a time that bends like a tape instead of clicking, and the ping-pong, multitap and grain modes on an AudioWorklet loaded from a blob, fed only while one plays.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the delay device: the echoes it makes, one line each and fainter as they fade, with a handle on the first to drag its time and feedback, over the device's knobs.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("distortion", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/effect-distortion"],
      description:
        "The distortion as a device: a curve (tanh, cubic, hard or fold, the curves of @audio/effect-distortion), a drive, a tone, a mix and an output level, the numbers that go on the nodes for a state, the table of each curve and the transfer curve a state plays, with no panel and no audio in it.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    engine: {
      description:
        "A distortion on the Web Audio API for a distortion state: a drive gain into the table of its curve at 4x oversampling, a tone filter, mixed with the clean sound at an output level, moving without a click.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the distortion device: its transfer curve against the straight line of a clean sound, over the choice of the curve, each button drawn from its curve, and the device knobs.",
      registryDependencies: ["@audio-ui/curve-select", "@audio-ui/plot"],
    },
  }),
  ...deviceItems("ducker", {
    device: {
      dependencies: [
        "@audio-ui/core",
        "@audio/dynamics-ducker",
        "@audio/dynamics-compressor",
      ],
      description:
        "The ducker as a device: a threshold, a ratio, a knee, a range, an attack and a release, the numbers that go on the worklet for a state, the gain it puts on the sound for a level of the key and the worklet's source (the ducker of @audio/dynamics-ducker), with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/manifest-worklet"],
    },
    engine: {
      description:
        "A ducker on the Web Audio API for a ducker state: the ducker of @audio/dynamics-ducker in an AudioWorklet loaded from a blob, the sound on its first input and the key from the sidechain on its second, fed only while it plays, the sound passing unchanged until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the ducker device: the gain it puts on the sound for each level of the key, with a handle on the threshold and the range it never goes under, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("electric-piano", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Electric Piano as an instrument device: a tine's body that barks and a bell that pings, rung down by itself, a pickup's drive and a tremolo, with four presets, and no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "One voice of the Electric Piano on the Web Audio API: noteOn strikes a note, which rings down by itself, or cuts the ringing one and strikes anew; noteOff lets it fall silent from where it got to; the drive, the tremolo and the volume follow the state without a click. A host plays chords with several.",
    },
    panel: {
      categories: ["device", "synth", "piano"],
      dependencies: ["@audio-ui/core", "@audio/note"],
      description:
        "The face of the Electric Piano device: its four presets, its controls by what they do (tone, pickup, tremolo, output) and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: ["@audio-ui/piano", "@shadcn/select"],
    },
  }),
  ...deviceItems("equalizer", {
    tags: ["plot"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The equalizer as a device: a low shelf, two bells and a high shelf with an output trim, their filters as a state describes them, and the curve a state plays, with no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "An equalizer on the Web Audio API for an equalizer state: four biquad filters in series with an output trim, the same filters its curve draws, moving without a click.",
    },
    panel: {
      categories: ["device", "plot", "knob"],
      dependencies: ["@audio-ui/core"],
      description:
        "The face of the equalizer device: the curve it plays with a handle on each band to drag its frequency and gain, an optional live spectrum behind it, over the device's knobs gathered by band.",
      registryDependencies: [
        "@audio-ui/plot",
        "@audio-ui/filter-type-select",
        "@shadcn/toggle",
      ],
    },
  }),
  ...deviceItems("exciter", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/effect-exciter"],
      description:
        "The exciter as a device: a frequency, a drive and an amount, the numbers that go on the worklet for a state, the band it excites and the worklet's source (the exciter of @audio/effect-exciter), with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "An exciter on the Web Audio API for an exciter state: the exciter of @audio/effect-exciter in an AudioWorklet loaded from a blob, the sound passing clean until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the exciter device: the band of highs it makes its harmonics from, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("expander", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/dynamics-expander"],
      description:
        "The expander as a device: a mode (downward or upward), a threshold, a ratio, a knee, a range, an attack and a release, the numbers that go on the worklet for a state, the curve a state plays and the worklet's source (the expander of @audio/dynamics-expander), with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/manifest-worklet"],
    },
    engine: {
      description:
        "An expander on the Web Audio API for an expander state: the expander of @audio/dynamics-expander in an AudioWorklet loaded from a blob, fed only while it plays, the sound passing unchanged until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the expander device: the mode picked in its title bar, its transfer curve against the straight line of a clean sound with a handle on the threshold, over the device knobs.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("filter", {
    device: {
      dependencies: [
        "@audio-ui/core",
        "@audio/filter-diode-ladder",
        "@audio/filter-korg35",
        "@audio/filter-moog-ladder",
        "@audio/filter-oberheim",
      ],
      description:
        "The filter as a device: a type, a circuit (two Moog ladders, a diode ladder, a Korg35 or an Oberheim SEM), a cutoff, a resonance and a drive, the numbers that go on the circuit worklet for a state, the worklet's source, and the curve a state plays, the circuit's measured on it, with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A filter on the Web Audio API for a filter state: the circuit an AudioWorklet loaded from a blob, the signal passing until it is ready and going round it when it is off, moving without a click.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the filter device: the curve its circuit plays with a handle on the cutoff to drag its frequency and resonance, an optional live spectrum behind it, the circuit picked in the title bar, over the device knobs.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("frequency-shifter", {
    device: {
      dependencies: [
        "@audio-ui/core",
        "@audio/effect-freqshift",
        "@audio/effect-ringmod",
      ],
      description:
        "The frequency shifter as a device: a mode (shift or ring), the shift in hertz, the ring's frequency, the shifter's precision and a mix, the numbers that go on the worklet for a state, its latency, what it does to a note and its harmonics and the worklet's source (the frequency shifter of @audio/effect-freqshift and the ring modulator of @audio/effect-ringmod), with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A frequency shifter on the Web Audio API for a frequency shifter state: an AudioWorklet loaded from a blob that plays both modes, one output each, faded by the mode, the sound passing clean until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the frequency shifter device: a note and its harmonics as they go in and as they come out, over the device knobs, the mode picked in its title bar.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("fm-synth", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The FM Synth as an instrument device: four operators, each a ratio, a level, a decay and a sustain, eight algorithms that wire them, feedback, an attack, a release and a vibrato, with eight presets, and no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "One voice of the FM Synth on the Web Audio API: four operators wired by the algorithm, each with its envelope; noteOn strikes a note, or cuts the held one and strikes anew, noteOff releases every operator from where it got to, and the levels, ratios, feedback and vibrato move a held note. A host plays chords with several.",
    },
    panel: {
      categories: ["device", "synth", "piano"],
      dependencies: ["@audio-ui/core", "@audio/note"],
      description:
        "The face of the FM Synth device: its eight presets, what every operator shares, each operator's four controls and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: ["@audio-ui/piano", "@shadcn/select"],
    },
  }),
  ...deviceItems("gate", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/dynamics-gate"],
      description:
        "The gate as a device: a threshold, a floor, an attack, a hold, a release and a look-ahead, the numbers that go on the worklet for a state, the source of the worklet of @audio/dynamics-gate and the curve a state plays, with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/manifest-worklet"],
    },
    engine: {
      description:
        "A gate on the Web Audio API for a gate state: the audio.js gate in a worklet, with its look-ahead, the signal passing until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the gate device: its transfer curve against the straight line of a clean sound with a handle on the threshold and a line where it closes, over the device knobs.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("graphic-eq", {
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The graphic EQ as a device: ten bands an octave apart, from 31 Hz to 16 kHz (the bands of @audio/eq-graphic), each a bell with a gain of its own, and an output level, the filters a state is and the curve it plays, with no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "A graphic EQ on the Web Audio API for a graphic EQ state: ten peaking filters in series and an output level, the same filters its curve draws, moving without a click.",
    },
    panel: {
      categories: ["device", "plot", "fader", "knob"],
      description:
        "The face of the graphic EQ device: the curve it plays over a fader for each of its ten bands, and the output knob beside them.",
      registryDependencies: ["@audio-ui/fader", "@audio-ui/plot"],
    },
  }),
  ...deviceItems("limiter", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/dynamics-limiter"],
      description:
        "The limiter as a device: an input gain, a ceiling and a release, the lookahead brickwall limiter of @audio/dynamics-limiter with its look-ahead and true peak, the numbers that go on the nodes for a state, the curve a state plays and the source of its worklet, with no panel and no audio in it.",
      kernels: true,
      registryDependencies: [
        "@audio-ui/oversampling",
        "@audio-ui/manifest-worklet",
      ],
    },
    engine: {
      description:
        "A limiter on the Web Audio API for a limiter state: the audio.js limiter in a worklet, the signal passing at the input gain until it is ready and going round it when it is off.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the limiter device: its transfer curve against the straight line of a clean sound with a handle for the ceiling and the input gain, over the device knobs.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("lofi", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/effect-lofi"],
      description:
        "The lo-fi as a device: its wow, flutter, hiss, crackle, the band a high-pass and a low-pass leave and a tape drive, the numbers that go on the worklet for a state, the band a state leaves and the worklet's source, with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A lo-fi on the Web Audio API for a lo-fi state: the kernel of @audio/effect-lofi in an AudioWorklet loaded from a blob, the sound passing clean until it is ready and when it is off.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the lo-fi device: the band it leaves between its high-pass and its low-pass, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("mid-side", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/spatial-microshift"],
      description:
        "The mid/side device as a device: a widening (off, a Haas delay or a detune, with their delay, cents and blend), a level for the mid, a level for the side and a bass mono frequency, the numbers that go on the nodes for a state and the source of the detune's worklet (the shifters of @audio/spatial-microshift), with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "A mid/side device on the Web Audio API for a mid/side state: the signal widened first, by a Haas delay or a detune in an AudioWorklet loaded from a blob, then split into mid and side, a level for each, a high-pass on the side for bass mono, and the two added back, moving without a click.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the mid/side device: a square with the side level across and the mid level up, and a handle to drag to both at once, over the bass mono and widening knobs, the widening picked in its title bar.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("mono-synth", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Mono Synth as an instrument device: a saw, square or triangle oscillator, a sub oscillator and noise, a resonant low-pass filter an envelope opens, a range, a glide and a vibrato, with eight presets, and no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Mono Synth on the Web Audio API, the whole synth in one engine: it takes every note by its id, the first opens the envelope, a note while one is held glides to it, and letting go of it glides back to the one still held. Every control moves a held note.",
    },
    panel: {
      categories: ["device", "synth", "piano"],
      dependencies: ["@audio-ui/core", "@audio-ui/icons", "@audio/note"],
      description:
        "The face of the Mono Synth device: its eight presets, the oscillator's wave and the range in its title bar, its controls by what they do (oscillators, filter, envelope, glide and vibrato) and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: [
        "@audio-ui/piano",
        "@shadcn/select",
        "@shadcn/toggle-group",
      ],
    },
  }),
  ...deviceItems("organ", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Organ as an instrument device: nine drawbars of sines at the organ's harmonics, a percussion on the second or third harmonic, a key click, a drive and a rotary speaker, with six registrations, and no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "One key of the Organ on the Web Audio API: nine sines at the drawbars' levels, with the percussion and the click, through a drive and a rotary speaker; noteOn sounds a key at once, or cuts the held one and sounds anew, noteOff stops it at once, and the drawbars move a held key. A host plays chords with several.",
    },
    panel: {
      categories: ["device", "synth", "piano"],
      dependencies: ["@audio-ui/core", "@audio/note"],
      description:
        "The face of the Organ device: its six registrations and the rotary speaker in its title bar, nine drawbars as faders, its percussion, key click, drive and volume, and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: [
        "@audio-ui/fader",
        "@audio-ui/piano",
        "@shadcn/select",
        "@shadcn/toggle-group",
      ],
    },
  }),
  ...deviceItems("string-machine", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The String Machine as an instrument device: a violin, a viola, a cello and a bass register, a brightness filter, an attack, a release and an ensemble, with eight presets, and no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "One voice of the String Machine on the Web Audio API: four registers into a brightness filter, bowed in and out from where it got to, through an ensemble; noteOn bows a note, or cuts the held one and bows anew, noteOff lets it go over the release, and the registers and the brightness move a held note. A host plays chords with several.",
    },
    panel: {
      categories: ["device", "synth", "piano"],
      dependencies: ["@audio-ui/core", "@audio/note"],
      description:
        "The face of the String Machine device: its eight presets, its controls by what they do (registers, tone, bow and output) and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: ["@audio-ui/piano", "@shadcn/select"],
    },
  }),
  ...deviceItems("tape-keys", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "Tape Keys as an instrument device: 35 keys, each a strip of tape with one note on it, on three tracks (flutes, strings and a choir), the tape's speed, wow and flutter, and a tone, and no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "One key of Tape Keys on the Web Audio API: its tape runs on the track chosen for eight seconds at most, a little off in pitch and level, with hiss, wow and flutter, through saturation and a tone; noteOn runs a key, or cuts the held one and runs anew, noteOff lets the tape go at once, and the speed, wow and tone move a held key. A host plays chords with several.",
    },
    panel: {
      categories: ["device", "synth", "piano"],
      dependencies: ["@audio-ui/core", "@audio/note"],
      description:
        "The face of the Tape Keys device: the track its heads read in its title bar, the tape's speed, wow and tone, the volume, and its 35 keys. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: ["@audio-ui/piano", "@shadcn/toggle-group"],
    },
  }),
  ...deviceItems("tilt-eq", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/biquad", "@audio/eq-tilt"],
      description:
        "The tilt EQ as a device: a tilt, a pivot and an output level, the numbers that go on the worklet for a state, the curve it plays (the shelves of @audio/biquad) and the worklet's source (the tilt of @audio/eq-tilt), with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A tilt EQ on the Web Audio API for a tilt EQ state: the tilt of @audio/eq-tilt in an AudioWorklet loaded from a blob, the sound passing clean until it is ready, then an output level.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the tilt EQ device: the curve it plays, tilted around a line at the pivot, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("guitar", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The guitar as a device: a plucked string that rings and fades, its highs first, through the body's warmth and a tone control, with its decay and palm mute, with no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "The guitar's Web Audio engine: one plucked string, drawn when its note comes and in tune to the cent, through the body and the tone; a host plays chords with several.",
    },
    panel: {
      categories: ["device", "synth", "piano"],
      dependencies: ["@audio-ui/core", "@audio/note"],
      description:
        "The guitar's face: the string's tone, decay and palm mute, the body and the volume, and a keyboard from the open low E up three octaves, controlled, with no audio in it.",
      registryDependencies: ["@audio-ui/piano"],
    },
  }),
  ...deviceItems("drum-synth", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "A synthesized drum as a device: a kick, a snare, a clap, a closed or an open hat, a tom, a rim or a cymbal, with its tuning, decay, tone and snap, played by velocity. Its state, its description and the tools an agent plays it with.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Drum Synth on the Web Audio API: one engine plays every hit, each made of a falling sine and filtered noise when it comes, from a noise made once per context, ringing for its decay whatever the note's length.",
    },
    panel: {
      categories: ["device", "synth", "pad"],
      dependencies: ["@audio-ui/core"],
      description:
        "The face of the Drum Synth device: its voice and tuning, decay, tone and snap, its volume, and a pad that strikes it, harder near its top.",
      registryDependencies: ["@audio-ui/pad"],
    },
  }),
  ...deviceItems("multiband", {
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The multiband compressor as a device: two splits and a threshold and ratio for each of the three bands, with an attack, a release and an output gain, the numbers that go on the nodes for a state and the bands a state draws, with no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "A multiband compressor on the Web Audio API for a multiband state: a Linkwitz-Riley split in three bands that add back flat, and for each band the compressor's detector driving its gain.",
      registryDependencies: ["@audio-ui/key-detector"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the multiband compressor device: the three bands drawn against frequency with a handle on each split, over the knobs of each band.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("overdrive", {
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The overdrive as a device: a band-pass before a soft clip with a drive, a tone and a mix, the numbers that go on the nodes for a state and the band that reaches the clip, with no panel and no audio in it.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    engine: {
      description:
        "An overdrive on the Web Audio API for an overdrive state: a band-pass, a drive gain, a soft-clip table at 4x oversampling and a tone filter, mixed with the clean sound, moving without a click.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the overdrive device: the band that reaches the clip with a handle on its centre, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("phaser", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/effect-phaser"],
      description:
        "The phaser-flanger as a device: a mode (phaser, classic or flanger), a rate, a depth, a centre frequency, a delay, the classic phaser's stages, a feedback and a mix, the numbers that go on the nodes for a state, the sweep and the source of the classic phaser's worklet (the phaser of @audio/effect-phaser), with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/synced-rate"],
    },
    engine: {
      description:
        "A phaser and flanger on the Web Audio API for a phaser state: four all-pass filters and a short delay swept by one oscillator, and the classic phaser's first-order stages in an AudioWorklet loaded from a blob, crossfaded by the mode, with feedback and a mix.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the phaser-flanger device: the sweep of its oscillator over two seconds, over the device knobs, with the ones the mode does not use drawn off, and the mode picked in its title bar.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("pocket-synth", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Pocket Synth as an instrument device: its waveform, filter and volume, and the pitch and filter cutoff a position on a pad plays, with no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "A monophonic synth on the Web Audio API for a Pocket Synth state: noteOn starts a note or glides the held one, noteOff releases it, and the wave, filter and volume follow the state without a click.",
    },
    panel: {
      categories: ["device", "synth", "xypad"],
      dependencies: ["@audio-ui/icons", "@audio/note"],
      description:
        "The face of the Pocket Synth device: a pad that plays it, its waveform and filter, and its volume. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: [
        "@audio-ui/fader",
        "@audio-ui/waveform-select",
        "@audio-ui/xypad",
        "@shadcn/toggle-group",
      ],
    },
  }),
  ...deviceItems("poly-synth", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Poly Synth as an instrument device: a saw, a pulse, a sub oscillator and noise, a resonant low-pass filter that follows the keyboard, an envelope for the filter and the level, a vibrato and a chorus, with eight presets, and no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "One voice of the Poly Synth on the Web Audio API: noteOn starts a note or glides the held one, noteOff releases it from where its envelope got to, and every control follows the state without a click. A host plays chords with several.",
    },
    panel: {
      categories: ["device", "synth", "piano"],
      dependencies: ["@audio-ui/core", "@audio/note"],
      description:
        "The face of the Poly Synth device: its eight presets, its controls by what they do (oscillators, filter, envelope, vibrato and chorus) and a keyboard that plays it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: ["@audio-ui/piano", "@shadcn/select"],
    },
  }),
  ...deviceItems("redux", {
    device: {
      dependencies: [
        "@audio-ui/core",
        "@audio/effect-bitcrusher",
        "@audio/effect-noiseshaper",
      ],
      description:
        "The redux as a device: a number of bits rounded to the nearest level or shaped, a downsample factor and a mix, the numbers that go on the nodes for a state, the stairs of the quantizer and the source of the worklet that holds and shapes, with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A redux on the Web Audio API for a redux state: a sample hold in an AudioWorklet loaded from a blob, which also shapes the bits, and a quantizer table that rounds them to the nearest level, mixed with the clean sound; the bits are crushed at once and the hold joins when the worklet is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the redux device: the stairs the bits make against the straight line of a clean sound, over the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("reverb", {
    device: {
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
    },
    engine: {
      description:
        "A reverb on the Web Audio API for a reverb state: a convolver fed a room made from the type, the decay and the damping, two of them cross-faded so a new room never clicks, after a pre-delay and mixed with the dry sound.",
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the reverb device: the tail it makes, its level falling to -60 dB, with a handle where it ends to drag the decay time, over the device knobs.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("rotary", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/effect-rotary"],
      description:
        "The rotary speaker as a device: a speed (slow, fast or stop), a crossover, a depth, the horn's and the drum's ramps, a width and a mix, the numbers that go on the worklet for a state, its two bands and the worklet's source (the rotary of @audio/effect-rotary, with the crossover it splits the sound with), with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A rotary speaker on the Web Audio API for a rotary state: the rotary of @audio/effect-rotary in an AudioWorklet loaded from a blob, a mono cabinet heard in stereo, the sound passing clean until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the rotary device: the drum's band and the horn's, split at the crossover, over its speed and the device knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("sampler", {
    tags: ["pad"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Sampler as an instrument device: one of two samples cut into sixteen slices, a key or a pad each from note 36, a low-pass filter, a pitch, a release and a gate, and no panel and no audio in it.",
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "One voice of the Sampler on the Web Audio API, with the two samples it comes with rendered once and shared: noteOn plays the slice its pitch picks, to its end, or cuts the playing one and plays anew; with the gate on, noteOff closes it over the release; load plays a file of your own. A host plays several slices at once with several.",
    },
    panel: {
      categories: ["device", "pad", "piano"],
      dependencies: ["@audio-ui/core", "@audio/note"],
      description:
        "The face of the Sampler device: its sample in its title bar, its controls and sixteen pads, one a slice, that play it. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: ["@audio-ui/pad", "@shadcn/select"],
    },
  }),
  ...deviceItems("stutter", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/effect-stutter"],
      description:
        "The stutter as a device: an interval and a slice in note values, a decay and a mix, the numbers that go on the worklet for a state at a tempo, one interval as the panel draws it and the worklet's source (the stutter of @audio/effect-stutter), with no panel and no audio in it.",
      kernels: true,
    },
    engine: {
      description:
        "A stutter on the Web Audio API for a stutter state: the stutter of @audio/effect-stutter in an AudioWorklet loaded from a blob, its lengths read against the host's tempo, a fresh cycle when it is turned on, the sound passing clean until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the stutter device: one interval in beats, the slice it catches and its repeats at the level the decay leaves, over the device knobs.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("saturator", {
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The saturator as a device: a curve, a drive, a mix and an output level, the numbers that go on the nodes for a state, the four curves and the transfer curve a state plays, with no panel and no audio in it.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    engine: {
      description:
        "A saturator on the Web Audio API for a saturator state: a drive gain into the table of the chosen curve at 4x oversampling, mixed with the clean sound at an output level; the table is rebuilt only when the curve changes.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the saturator device: its transfer curve against the straight line of a clean sound, over the device knobs and the choice of curve.",
      registryDependencies: ["@audio-ui/curve-select", "@audio-ui/plot"],
    },
  }),
  ...deviceItems("transient", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/dynamics-transient-shaper"],
      description:
        "The transient shaper as a device: an attack and a sustain, each up or down by 12 dB, and an output gain, the numbers that go on the nodes for a state and the source of the worklet of @audio/dynamics-transient-shaper, with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/manifest-worklet"],
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "A transient shaper on the Web Audio API for a transient state: the audio.js shaper in a worklet, the signal passing unchanged until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the transient shaper device: a square with the sustain across and the attack up, and a handle to drag to both at once, over the output knob.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("unlimiter", {
    device: {
      dependencies: ["@audio-ui/core", "@audio/dynamics-unlimit"],
      description:
        "The unlimiter as a device: an amount, a drive, a crest, adaptive and a guarded ceiling, the numbers that go on the worklet for a state, the lift it gives an attack by its size and the worklet's source (the de-limiter of @audio/dynamics-unlimit), with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/manifest-worklet"],
    },
    engine: {
      description:
        "An unlimiter on the Web Audio API for an unlimiter state: the de-limiter of @audio/dynamics-unlimit in an AudioWorklet loaded from a blob, fed only while it plays, the sound passing unchanged until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the unlimiter device: the lift it gives an attack for its size, with the crest an attack is lifted to, over the device knobs and switches.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("utility", {
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The utility as a device: a gain, a pan, a stereo width, a mono switch and a phase invert, the numbers that go on the nodes for a state, with no panel and no audio in it.",
    },
    engine: {
      description:
        "A utility on the Web Audio API for a utility state: the signal split into mid and side, the side scaled by the width, then a pan and a gain with an optional phase invert, moving without a click.",
    },
    panel: {
      categories: ["device", "knob"],
      description:
        "The face of the utility device: its gain, pan and width as knobs and its mono and invert switches.",
    },
  }),
  ...deviceItems("vibe", {
    tags: ["modulation"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The vibe as a device: a lamp that pulses on four phase-shift stages spread wide apart, in chorus or vibrato, with its speed, intensity and level, the lamp's cycle and what it shows, and no panel and no audio in it.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "The vibe on the Web Audio API: a warm preamp, four all-pass stages swept by an oscillator of the lamp's own wave, mixed half dry in chorus or alone in vibrato, and a bypass when it is off.",
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the vibe device: the lamp's light over two seconds, rising fast and fading slowly, over its mode and its knobs.",
      registryDependencies: ["@audio-ui/plot"],
    },
  }),
  ...deviceItems("wah", {
    device: {
      dependencies: [
        "@audio-ui/core",
        "@audio/effect-autowah",
        "@audio/effect-wah",
      ],
      description:
        "The wah as a device: a mode (envelope, sweep or pedal), the band's frequency and resonance, an envelope's range, sensitivity, attack and release, an oscillator's rate or note value and depth, a mix and an output, the numbers that go on the worklet for a state, the band's travel and curve and the worklet's source (the auto-wah of @audio/effect-autowah and the wah of @audio/effect-wah), with no panel and no audio in it.",
      kernels: true,
      registryDependencies: ["@audio-ui/synced-rate"],
    },
    engine: {
      description:
        "A wah on the Web Audio API for a wah state: an AudioWorklet loaded from a blob that plays every mode, one output each, faded by the mode, mixed with the clean sound at an output level, the sound passing clean until it is ready.",
      registryDependencies: ["@audio-ui/audio-worklet"],
    },
    panel: {
      categories: ["device", "plot", "knob"],
      description:
        "The face of the wah device: the band where it rests, and dashed where its travel ends, over the device knobs, the mode picked in its title bar.",
      registryDependencies: ["@audio-ui/plot", "@shadcn/select"],
    },
  }),
  ...deviceItems("wave-shaper", {
    tags: ["synth"],
    device: {
      dependencies: ["@audio-ui/core"],
      description:
        "The Wave Shaper as an instrument device: its waveform, drive, tone, detune, mix and volume, the pitch and resonance a pad position plays, and the distortion curve, with no panel and no audio in it.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    engine: {
      dependencies: ["@audio-ui/core"],
      description:
        "A wave shaper synth on the Web Audio API for a Wave Shaper state: two detuned oscillators, a distortion mixed in parallel and a low-pass filter; noteOn starts a note or glides the held one, noteOff releases it.",
      registryDependencies: ["@audio-ui/oversampling"],
    },
    panel: {
      categories: ["device", "synth", "xypad"],
      dependencies: ["@audio/note"],
      description:
        "The face of the Wave Shaper device: a pad that plays it, its waveform and its knobs. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
      registryDependencies: ["@audio-ui/waveform-select", "@audio-ui/xypad"],
    },
  }),
];
