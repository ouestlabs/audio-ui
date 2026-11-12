# @audio-ui/engine

## 0.3.0

### Minor Changes

- 710e7fe: Files: `mixChannels(channels, layout)` mixes a sound to mono, stereo, 5.1 or 7.1, folding the centre and the surrounds into the sides at -3 dB on the way down and spreading the sides to the surrounds on the way up, and `resampleChannels(channels, from, to)` converts every channel to another sample rate. `CHANNEL_LAYOUTS` and `LAYOUT_CHANNELS` name the layouts and their channel counts.

## 0.2.0

### Minor Changes

- 5e441c4: Analysis: `detectSilences(channels, sampleRate, options?)` finds where a recording pauses between its sounds, as `[from, to]` in seconds: each stretch of at least 60 ms where every sample stays under -34 dBFS, or 20 dB under the loudest sample of a quiet recording, with the threshold and the shortest pause of your own.

### Patch Changes

- Updated dependencies [5e441c4]
  - @audio-ui/core@0.29.1

## 0.1.0

### Minor Changes

- 04a9fae: First release: the audio logic behind the controls, with no UI framework in it. `device`, `time`, `analysis`, `midi`, `pitch` and `playback`, which were subpaths of `@audio-ui/core`, are its modules, with the same exports. `pitch` keeps the named scales and adds `rollScale`, a scale as the piano roll reads it, `detectKeys`, `midiToHz` and `cents`. What the registry built on audio.js is in it too: `files` (audio decoding and encoding, MIDI and MusicXML files), `worklet` (`loadWorklet`), the engine contracts, worklet stages, feeds, noise and measurements in `device`, and loudness, `detectPitch`, `analyzeBeat` and `audioChroma` in `analysis`. `playback` adds `playedVelocity`, how hard a note plays this time round with its chance and deviation. The devices' audio.js is the engine's as well: `kernels`, the code each device's worklet runs, and `dsp`, the models, gain curves, filter circuits and reverbs their descriptions use.

### Patch Changes

- Updated dependencies [04a9fae]
- Updated dependencies [04a9fae]
  - @audio-ui/core@0.29.0
