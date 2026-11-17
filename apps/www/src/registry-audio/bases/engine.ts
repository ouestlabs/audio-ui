/**
 * The engine as the registry ships it: one item per module, `engine-<module>`,
 * from `base/lib/engine/<module>/`, installed to `lib/engine/<module>/`. A file
 * of the registry imports a module as `@/engine/<module>` (a tsconfig path),
 * which the build rewrites to `@/lib/engine/<module>`, and the item that
 * imports it gets the module's item. `test/engine-items.test.ts` keeps the
 * lists below in step with the folder.
 */

const ENGINE_IMPORT = /(["'])@\/engine\/([a-z-]+)\1/g;
const INSTALLED_ENGINE_IMPORT = /["']@\/lib\/engine\/([a-z-]+)["']/g;

/** A file of the registry imports a module of the engine where it installs: `@/engine/time` becomes `@/lib/engine/time`. */
export function rewriteEngineImports(content: string) {
  return content.replace(
    ENGINE_IMPORT,
    (_match, quote: string, name: string) =>
      `${quote}@/lib/engine/${name}${quote}`
  );
}

/** The items of the engine's modules a built file imports: `engine-time` for `@/lib/engine/time`. */
export function engineDependencies(content: string) {
  return new Set(
    [...content.matchAll(INSTALLED_ENGINE_IMPORT)].map(
      ([, name]) => `engine-${name}`
    )
  );
}

export interface EngineModule {
  /** The npm packages its files import, with the version the registry pins. */
  dependencies: string[];
  description: string;
  /** Its files, by path from `base/lib/engine/<module>/`. */
  files: string[];
  /** The other modules its files import. */
  modules: string[];
}

export const ENGINE_MODULES: Record<string, EngineModule> = {
  analysis: {
    dependencies: [
      "@audio/beat-detect@1.1.0",
      "@audio/biquad@1.2.2",
      "@audio/eq-crossover@1.0.2",
      "@audio/loudness-lufs@1.2.0",
      "@audio/loudness-truepeak@1.1.7",
      "@audio/mir-chroma@1.1.3",
      "@audio/pitch-yin@1.0.6",
      "@audio/stft@2.0.0",
      "@audio/weighting-k@1.2.1",
    ],
    description:
      "Reading a signal: levels in dB, a spectrum on a log axis and its held peaks, the curves of a filter, an equalizer and a compressor, waveform peaks, transients, pauses and auto-warp. Plain functions, for the main thread, a worker or a worklet.",
    files: [
      "beat.ts",
      "compressor.ts",
      "filter.ts",
      "index.ts",
      "level.ts",
      "loudness.ts",
      "peaks.ts",
      "pitch.ts",
      "recording.ts",
      "report.ts",
      "silence.ts",
      "spectra.ts",
      "spectrum.ts",
      "stereo.ts",
      "tint.ts",
    ],
    modules: ["pitch", "time", "worklet"],
  },
  device: {
    dependencies: [
      "@audio/measure-latency@1.0.2",
      "@audio/measure-response@1.0.2",
      "@audio/synth-noise@2.0.1",
    ],
    description:
      "A device as a description: defineDevice and its parameters, a state and apply with what each change did, the bindings an engine implements, and the tools an agent drives it with.",
    files: [
      "define.ts",
      "engine.ts",
      "index.ts",
      "instrument.ts",
      "measure.ts",
      "scale.ts",
      "tools.ts",
    ],
    modules: ["time", "worklet"],
  },
  dsp: {
    dependencies: [
      "@audio/biquad@1.2.2",
      "@audio/dynamics-compand@catalog:",
      "@audio/dynamics-compressor@catalog:",
      "@audio/dynamics-deesser@catalog:",
      "@audio/dynamics-expander@catalog:",
      "@audio/dynamics-fet@0.2.5",
      "@audio/dynamics-limiter@catalog:",
      "@audio/dynamics-opto@0.2.5",
      "@audio/dynamics-unlimit@catalog:",
      "@audio/dynamics-varimu@0.2.4",
      "@audio/dynamics-vca@0.2.5",
      "@audio/effect-distortion@catalog:",
      "@audio/filter-diode-ladder@catalog:",
      "@audio/filter-korg35@1.2.1",
      "@audio/filter-moog-ladder@catalog:",
      "@audio/filter-oberheim@1.2.1",
      "@audio/reverb-dattorro@1.1.3",
      "@audio/reverb-fdn@1.1.3",
      "@audio/reverb-freeverb@1.0.5",
      "@audio/reverb-schroeder@1.1.3",
      "@audio/reverb-spring@1.1.3",
    ],
    description:
      "The audio.js processors the registry's devices are built on: compressor and expander models, the gain curves of dynamics, filter circuits, reverbs and biquad shelves, under one dependency.",
    files: ["index.ts"],
    modules: [],
  },
  files: {
    dependencies: [
      "@audio/biquad@1.2.2",
      "@audio/effect-noiseshaper@catalog:",
      "@audio/midi-parse@1.0.3",
      "@audio/midi-write@1.0.3",
      "@audio/musicxml@0.1.0",
      "@audio/resample-sinc@1.3.0",
      "@audio/shift@1.2.0",
      "@audio/stretch@2.3.0",
      "fflate@catalog:",
    ],
    description:
      "Files: an audio file decoded into samples at a context's rate, sound written to WAV, FLAC or MP3, notes read from and written to a MIDI file, and a score read from and written to MusicXML.",
    files: [
      "audio-decode.ts",
      "audio-encode.ts",
      "channels.ts",
      "index.ts",
      "midi-file.ts",
      "musicxml-file.ts",
      "process.ts",
      "time-pitch.ts",
    ],
    modules: ["analysis", "playback"],
  },
  format: {
    dependencies: [],
    description:
      "Audio quantities as text, the way the standards and the tools write them: levels in dBFS, dBTP and LUFS, frequencies and sample rates, times, notes, pans, ratios, tempos, channel layouts, each a function of the value and options, and createFormatter to bind a locale, a true minus or a spacing once.",
    files: ["index.ts"],
    modules: [],
  },
  kernels: {
    dependencies: [],
    description:
      "The audio.js kernels each device of the registry runs in an AudioWorklet: every module as published, in a string, since a worklet cannot import.",
    files: [
      "bass-enhancer.ts",
      "binaural-panner.ts",
      "chorus.ts",
      "compander.ts",
      "compressor.ts",
      "deesser.ts",
      "delay.ts",
      "ducker.ts",
      "exciter.ts",
      "expander.ts",
      "filter.ts",
      "frequency-shifter.ts",
      "gate.ts",
      "index.ts",
      "limiter.ts",
      "lofi.ts",
      "mid-side.ts",
      "phaser.ts",
      "redux.ts",
      "rotary.ts",
      "stutter.ts",
      "tilt-eq.ts",
      "transient.ts",
      "unlimiter.ts",
      "wah.ts",
    ],
    modules: [],
  },
  midi: {
    dependencies: [],
    description:
      "MIDI input: every connected keyboard and controller as one source through the Web MIDI API, raw messages read into notes, controllers and pitch bend, and pitch bend in semitones.",
    files: ["index.ts", "input.ts", "message.ts"],
    modules: [],
  },
  pitch: {
    dependencies: ["@audio/mir-key@1.0.2", "@audio/note@1.0.3"],
    description:
      "Named scales: the steps of each scale, the pitch classes a scale on a root keeps, whether a pitch is in it and the nearest one that is, and the scale as a piano roll reads it.",
    files: ["index.ts", "key.ts", "scale.ts"],
    modules: [],
  },
  playback: {
    dependencies: [],
    description:
      "What plays when: audio clips placed in frames, the transport's state on the audio clock, the clip player's processor and its renderer, recordings streamed in pages, and the mixer's pan law, solo and delay compensation.",
    files: [
      "clip.ts",
      "index.ts",
      "loader-worker-source.ts",
      "loader-worker.ts",
      "loader.ts",
      "mixer.ts",
      "note.ts",
      "plan.ts",
      "protocol.ts",
      "render.ts",
      "stream.ts",
      "transport.ts",
      "worklet-source.ts",
      "worklet.ts",
    ],
    modules: ["analysis", "time"],
  },
  repair: {
    dependencies: ["@audio/denoise@0.11.2"],
    description:
      "Defects taken out of a recording, each by the method made for it: clicks, crackle, mains hum, steady and changing noise, clipping, wind, plosives, breaths and reverb, or one that finds the defect itself, on audio.js's denoise family.",
    files: ["index.ts"],
    modules: [],
  },
  time: {
    dependencies: [],
    description:
      "Musical time: tempos and signatures, bars and beats, grid divisions and their labels, tempo-synced note values, warp markers, the metronome, and the look-ahead scheduler a transport clock runs on.",
    files: [
      "grid.ts",
      "index.ts",
      "meter.ts",
      "scheduler.ts",
      "tempo.ts",
      "warp.ts",
    ],
    modules: [],
  },
  worklet: {
    dependencies: [],
    description:
      "Loading an AudioWorklet processor: its source into a context from a blob, once per context, false where worklets cannot run.",
    files: ["index.ts", "load.ts"],
    modules: [],
  },
};
