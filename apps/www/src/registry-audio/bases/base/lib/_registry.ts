import type { RegistryItem } from "shadcn/schema";
import { libItem } from "../../items";

const items: RegistryItem[] = [
  libItem("web-audio", {
    categories: ["lib", "audio", "web-audio"],
    description: "Web Audio Lib",
  }),
  libItem("device-engine", {
    categories: ["lib", "audio", "device", "web-audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "What a device's engine is and the pieces engines are made of: the EffectEngine and InstrumentEngine contracts every create<Name>Engine returns, a worklet stage that takes over from the clean sound once loaded, and a feed that keeps a worklet fed only while its path is heard.",
    registryDependencies: ["@audio-ui/audio-worklet"],
  }),
  libItem("audio-worklet", {
    categories: ["lib", "audio", "web-audio"],
    description:
      "Loads the source of an AudioWorklet processor into a context, from a blob and once per context: every device engine and lib that runs a worklet loads it this way, and gets false where worklets cannot run.",
  }),
  libItem("envelope-ramp", {
    categories: ["lib", "audio", "synth", "piano", "envelope"],
    description:
      "Envelope curves to gain automation: slicing an envelope at its sustain and scheduling its ramps on a GainNode's AudioParam, for synth voices",
  }),
  libItem("audio-decode", {
    categories: ["lib", "audio", "waveform"],
    dependencies: [
      "@audio/decode-aiff",
      "@audio/decode-caf",
      "@audio/decode-mp4",
      "@audio/resample-sinc",
    ],
    description:
      "Decoding an audio file into samples at a context's rate, the step before the waveform maths of @audio-ui/core/analysis: the browser's decoder first, and for an AIFF, CAF or Apple Lossless file it refuses, as Chrome does, a decoder of its format and a resampler, loaded the first time one is needed",
  }),
  libItem("audio-encode", {
    categories: ["lib", "audio"],
    dependencies: ["@audio/encode"],
    description:
      "Writing sound to a WAV, FLAC or MP3 file, the step after an offline render or a recording: encoded in chunks with its progress, each format's encoder loaded the first time it is used, and saved through the browser's downloads",
  }),
  libItem("loudness", {
    categories: ["lib", "audio"],
    dependencies: [
      "@audio-ui/core",
      "@audio/loudness-lufs",
      "@audio/loudness-truepeak",
      "@audio/weighting-k",
    ],
    description:
      "How loud a sound is, the way streaming services and broadcasters measure it (ITU-R BS.1770): integrated loudness in LUFS, sample and true peak, and the gain that brings it to a target such as -14 LUFS without passing a true-peak ceiling; and while it plays, its momentary, short-term and integrated loudness, measured on the audio thread",
    registryDependencies: ["@audio-ui/audio-worklet"],
  }),
  libItem("audio-export", {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "Exporting rendered sound to a file: the settings an export picks (format, bit depth or bitrate, a level left as it is, brought to its peak or to a loudness target) and exportSound, which measures, normalizes and encodes, saying how far it is",
    registryDependencies: ["@audio-ui/audio-encode", "@audio-ui/loudness"],
  }),
  libItem("device-measure", {
    categories: ["lib", "audio", "device", "web-audio"],
    description:
      "Measure an engine against what its device claims, in an offline audio context: how far its frequency response is from the curve the panel draws, how long it delays a signal, and the helpers to render and read a signal. For a host that brings its own engine.",
  }),
  libItem("manifest-worklet", {
    categories: ["lib", "audio", "device", "web-audio"],
    description:
      "The source of an AudioWorklet processor that plays one of several audio.js manifests (the audio.js of an @audio/* package): the model sent by message, a parameter it reads as it plays changed at once, a model made again for one it is made with, warmed on the last 100 ms and faded in, its state brought back to rest on silence, and a meter of the gain it takes off.",
  }),
  libItem("oversampling", {
    categories: ["lib", "audio", "device", "web-audio"],
    description:
      "What a waveshaper that oversamples costs in time, and a delay that holds a dry path back by it, so a distortion mixed with its dry sound does not comb. Measured in Chrome.",
  }),
  libItem("synced-rate", {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "The rate of an oscillator that is either free, in hertz, or synced: one cycle per note value of the host's tempo. The two parameters a device adds for it, and the function that reads the rate.",
  }),
  libItem("demo-sound", {
    categories: ["lib", "audio", "device", "web-audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "The sounds the previews play, by name: Boom bap and Drone, with the kick that goes with the first. Drawn once in code and looped as a buffer, no samples.",
    registryDependencies: ["@audio-ui/drum-synthesis"],
  }),
  libItem("drum-kit", {
    categories: ["lib", "audio"],
    description:
      "A drum kit to start a drum rack from: a pad per drum on the General MIDI notes, each a Drum Synth at the head of its chain, the snare and the clap in a small room, the hats in one choke group.",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/drum-synth-device",
      "@audio-ui/reverb-device",
    ],
  }),
  libItem("drum-steps", {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "A drum clip's notes as steps: a row per pad, a step per stretch of the grid, with each step's velocity, chance and shift, and the edits a step sequencer makes on the notes (switch a step, set its level, fill a row every n steps).",
  }),
  libItem("demo-song", {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "A chill song at 80 BPM on one two-bar loop, E minor seven, G and A, all of it notes for MIDI tracks: its drums on a drum kit's pads, one part each with a fill, and an organ, a pad, a bass and a lead hook. What the arrangement's demo plays.",
    registryDependencies: ["@audio-ui/drum-kit"],
  }),
  libItem("arrangement", {
    categories: ["lib", "audio", "timeline"],
    dependencies: [
      "@audio-ui/core",
      "@audio-ui/react",
      "@audio/beat-detect",
      "@audio/mir-chroma",
    ],
    description:
      "The document of an arrangement of clips on tracks: its clips, tracks and mixes, how far a clip reaches, where a MIDI clip's notes play, and what a track's volume and pan automation gives at a point of the song",
  }),
  libItem("undo-history", {
    categories: ["lib", "audio", "timeline"],
    description:
      "Undo and redo as a value: a pure history of any document, with bursts (a drag is one entry), redo that drops on a new change, and a depth limit",
  }),
  libItem("midi-file", {
    categories: ["lib", "piano"],
    dependencies: ["@audio-ui/core", "@audio/midi-parse", "@audio/midi-write"],
    description:
      "MIDI files to and from notes on a grid of steps: read one, with its tempo, write one, or download one; or read one as parts in beats, a part per track and channel with its name and program, for a host that lays each on a track (parsed by @audio/midi-parse, written by @audio/midi-write)",
  }),
  libItem("musicxml-file", {
    categories: ["lib", "piano"],
    dependencies: ["@audio-ui/core", "@audio/musicxml", "fflate"],
    description:
      "MusicXML scores to and from notes on a grid of steps: read one, plain or compressed as .mxl, with its first tempo, every part into one clip, write one for a notation app, or download one",
    registryDependencies: ["@audio-ui/midi-file"],
  }),
  libItem("rack", {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "Racks: devices in parallel chains, each with its volume, pan, switch and solo, lined up on the slowest and summed, and eight macros that turn parameters of the devices inside over a stretch of their travel; the engine that plays one on a track's chain.",
    registryDependencies: ["@audio-ui/arrangement", "@audio-ui/device-library"],
  }),
  libItem("drum-rack", {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "Drum racks: an instrument whose chains are pads, each answering a note with the instrument at its head, such as a Drum Synth, or else a voice of the drum synthesis or a recording, into its own devices, a pad of a choke group cutting the others short; the engine that plays one on a MIDI track.",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/drum-synthesis",
      "@audio-ui/instrument-rack",
      "@audio-ui/rack",
      "@audio-ui/voice-pool",
    ],
  }),
  libItem("polyphony", {
    categories: ["lib", "audio", "synth"],
    dependencies: ["@audio-ui/core"],
    description:
      "Chords on an instrument whose engine plays one voice: a note takes the voice that holds it, else a free one, else the one held longest, whose note is let go first. No sound and no engine of its own: it plays the engines it is given.",
  }),
  libItem("voice-pool", {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core", "@audio/note"],
    description:
      "Note players: what a MIDI track plays through, all taking notes the same way, and the voice pool that plays an instrument of the library with a voice for each note it holds, the oldest given up first.",
    registryDependencies: ["@audio-ui/device-library", "@audio-ui/polyphony"],
  }),
  libItem("instrument-rack", {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core"],
    description:
      "Instrument racks: an instrument whose chains each start with an instrument of the library, then effects, all played by every note in layers and summed as a rack with its macros; the engine that plays one on a MIDI track.",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/device-library",
      "@audio-ui/rack",
      "@audio-ui/voice-pool",
    ],
  }),
  libItem("dawproject", {
    categories: ["lib", "audio"],
    dependencies: ["@audio-ui/core", "fflate"],
    description:
      "An arrangement to and from DAWproject, the open exchange format other DAWs read and write: tracks, returns and the main track with their mix and sends, audio clips with fades, loop and warp, MIDI clips, volume and pan automation, locators, tempo and time signatures, and the equalizer, compressor, gate and limiter; a report says what was left out. With the zip archives it is packed in.",
    files: ["lib/dawproject.ts", "lib/zip.ts"],
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
      "@audio-ui/compressor-device",
      "@audio-ui/equalizer-device",
      "@audio-ui/gate-device",
      "@audio-ui/limiter-device",
    ],
  }),
  libItem("recording", {
    categories: ["lib", "audio", "timeline"],
    dependencies: ["@audio-ui/core"],
    description:
      "Recording into an arrangement: an input recorder on an AudioWorklet that keeps each block with its frame on the audio clock, the frames of a take with the latency taken off, and the audio or MIDI clip a take becomes, with record quantization and overdub",
    files: ["lib/recording.ts", "lib/input-recorder.ts"],
    registryDependencies: ["@audio-ui/audio-worklet", "@audio-ui/arrangement"],
  }),
  libItem("clip-player", {
    categories: ["lib", "audio", "timeline"],
    dependencies: ["@audio-ui/core"],
    description:
      "A track's player of audio clips on an AudioWorklet: its recordings to the frame on the audio clock, with gain, fades, loops, reverse and warp, in a running or an offline context",
    registryDependencies: ["@audio-ui/audio-worklet"],
  }),
  libItem("device-library", {
    categories: ["lib", "audio", "device"],
    dependencies: ["@audio-ui/core"],
    description:
      "Every device of the registry with its engine, by shelf: what a host needs to build a track's chain from the ids a project stores, and what a device browser lists",
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
      "@audio-ui/guitar-device",
      "@audio-ui/guitar-engine",
      "@audio-ui/drum-synth-device",
      "@audio-ui/drum-synth-engine",
      "@audio-ui/sampler-device",
      "@audio-ui/sampler-engine",
      "@audio-ui/electric-piano-device",
      "@audio-ui/electric-piano-engine",
      "@audio-ui/redux-device",
      "@audio-ui/redux-engine",
      "@audio-ui/lofi-device",
      "@audio-ui/lofi-engine",
      "@audio-ui/unlimiter-device",
      "@audio-ui/unlimiter-engine",
      "@audio-ui/compander-device",
      "@audio-ui/compander-engine",
      "@audio-ui/ducker-device",
      "@audio-ui/ducker-engine",
      "@audio-ui/expander-device",
      "@audio-ui/expander-engine",
      "@audio-ui/binaural-panner-device",
      "@audio-ui/binaural-panner-engine",
      "@audio-ui/stutter-device",
      "@audio-ui/stutter-engine",
      "@audio-ui/rotary-device",
      "@audio-ui/rotary-engine",
      "@audio-ui/bass-enhancer-device",
      "@audio-ui/bass-enhancer-engine",
      "@audio-ui/exciter-device",
      "@audio-ui/exciter-engine",
      "@audio-ui/frequency-shifter-device",
      "@audio-ui/frequency-shifter-engine",
      "@audio-ui/wah-device",
      "@audio-ui/wah-engine",
      "@audio-ui/graphic-eq-device",
      "@audio-ui/graphic-eq-engine",
      "@audio-ui/tilt-eq-device",
      "@audio-ui/tilt-eq-engine",
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
  }),
  libItem("mixer-engine", {
    categories: ["lib", "audio", "mixer"],
    dependencies: ["@audio-ui/core"],
    description:
      "A mixer on the Web Audio API: a channel per track and return, with its chain, volume, constant-power pan, switch, solo, pre or post-fader sends, delay compensation and meters, into a main track",
  }),
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
  libItem("piano-roll-tools", {
    categories: ["lib", "audio", "piano", "ai"],
    dependencies: ["zod"],
    description:
      "AI-native tool surface for a piano roll, createPianoRollTools builds typed, agent-agnostic tools (setNotes/addNotes/removeNotes/transpose/clear/setTempo) an LLM calls to compose melodies and basslines from natural language, parameterized by the roll's pitch range and grid",
  }),
  libItem("drum-synthesis", {
    categories: ["lib", "audio", "synth", "sequencer"],
    description:
      "One-shot percussion synthesis (kick, snare, hihat) built from oscillators and noise bursts, each with its own tune and decay",
  }),
  {
    dependencies: ["@audio-ui/core"],
    description:
      "Moved: the peaks are in @audio-ui/core/analysis and the decoding is audio-decode, as this lib gave both.",
    files: [],
    name: "waveform-peaks",
    registryDependencies: ["@audio-ui/audio-decode"],
    type: "registry:lib",
  },
  libItem("sortable-drag", {
    categories: ["lib", "audio"],
    description:
      "The gesture of reordering a row by dragging one of its items: the others slide aside, the item shows dimmed where it would land, what follows the pointer settles there, the view scrolls at its edges. No render while it moves.",
  }),
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
