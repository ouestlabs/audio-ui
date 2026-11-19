/**
 * The engine and the GPU drawing as the registry ships them: one item per
 * module, `<set>-<module>` (`engine-time`, `webgl-waveform`), from
 * `registry/lib/<set>/<module>/`, installed to `lib/<set>/<module>/`. A file of the
 * registry imports a module as `@/<set>/<module>` (a tsconfig path), which the
 * build rewrites to `@/lib/<set>/<module>`, and the item that imports it gets
 * the module's item. `test/lib-modules.test.ts` keeps the lists below in step
 * with the folders.
 */

const MODULE_IMPORT = /(["'])@\/(engine|webgl)\/([a-z-]+)\1/g;
const INSTALLED_MODULE_IMPORT = /["']@\/lib\/(engine|webgl)\/([a-z-]+)["']/g;

/** A file of the registry imports a module where it installs: `@/engine/time` becomes `@/lib/engine/time`. */
export function rewriteModuleImports(content: string) {
  return content.replace(
    MODULE_IMPORT,
    (_match, quote: string, set: string, name: string) =>
      `${quote}@/lib/${set}/${name}${quote}`
  );
}

/** The items of the modules a built file imports: `engine-time` for `@/lib/engine/time`. */
export function moduleDependencies(content: string) {
  return new Set(
    [...content.matchAll(INSTALLED_MODULE_IMPORT)].map(
      ([, set, name]) => `${set}-${name}`
    )
  );
}

export interface LibModule {
  /** The npm packages its files import. */
  dependencies: string[];
  description: string;
  /** Its files, by path from `registry/lib/<set>/<module>/`. */
  files: string[];
  /** The other modules its files import. */
  modules: string[];
}

export const ENGINE_MODULES: Record<string, LibModule> = {
  analysis: {
    dependencies: [
      "@audio/beat-detect",
      "@audio/biquad",
      "@audio/eq-crossover",
      "@audio/loudness-lufs",
      "@audio/loudness-truepeak",
      "@audio/mir-chroma",
      "@audio/pitch-yin",
      "@audio/stft",
      "@audio/weighting-k",
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
      "@audio/measure-latency",
      "@audio/measure-response",
      "@audio/synth-noise",
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
      "@audio/biquad",
      "@audio/dynamics-compand",
      "@audio/dynamics-compressor",
      "@audio/dynamics-deesser",
      "@audio/dynamics-expander",
      "@audio/dynamics-fet",
      "@audio/dynamics-limiter",
      "@audio/dynamics-opto",
      "@audio/dynamics-unlimit",
      "@audio/dynamics-varimu",
      "@audio/dynamics-vca",
      "@audio/effect-distortion",
      "@audio/filter-diode-ladder",
      "@audio/filter-korg35",
      "@audio/filter-moog-ladder",
      "@audio/filter-oberheim",
      "@audio/reverb-dattorro",
      "@audio/reverb-fdn",
      "@audio/reverb-freeverb",
      "@audio/reverb-schroeder",
      "@audio/reverb-spring",
    ],
    description:
      "The audio.js processors the registry's devices are built on: compressor and expander models, the gain curves of dynamics, filter circuits, reverbs and biquad shelves, under one dependency.",
    files: ["index.ts"],
    modules: [],
  },
  files: {
    dependencies: [
      "@audio/biquad",
      "@audio/decode-aiff",
      "@audio/decode-caf",
      "@audio/decode-mp4",
      "@audio/effect-noiseshaper",
      "@audio/encode",
      "@audio/midi-parse",
      "@audio/midi-write",
      "@audio/musicxml",
      "@audio/resample-sinc",
      "@audio/shift",
      "@audio/stretch",
      "fflate",
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
    dependencies: ["@audio/mir-key", "@audio/note"],
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
    dependencies: ["@audio/denoise"],
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

export const WEBGL_MODULES: Record<string, LibModule> = {
  lane: {
    dependencies: [],
    description:
      "What every GPU lane shares: placing the canvas on what the view shows, the clips in view with the frames they read, drawing again on a change of inputs, a resize, a scroll or the theme, and whether this browser has WebGL 2.",
    files: ["index.ts"],
    modules: [],
  },
  spectrogram: {
    dependencies: ["gl-spectrogram"],
    description:
      "The spectrograms of a lane's clips on one canvas and one WebGL context, computed on the GPU by gl-spectrogram on one of four frequency axes, with the band zoom, the pointer's cell and the frequency axis laid out for a lane.",
    files: ["index.ts"],
    modules: ["lane"],
  },
  waveform: {
    dependencies: ["gl-waveform"],
    description:
      "The waveforms of a lane's clips on one canvas and one WebGL context, drawn on the GPU by gl-waveform: exact peaks and the RMS inside, a line through the samples zoomed in, plain or as the three bands of the sound.",
    files: ["index.ts"],
    modules: ["lane"],
  },
};

/** Each set of modules, by the folder it is in and the prefix of its items. */
export const MODULE_SETS = {
  engine: ENGINE_MODULES,
  webgl: WEBGL_MODULES,
} as const;
