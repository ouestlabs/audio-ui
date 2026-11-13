# @audio-ui/engine

## 0.13.0

### Minor Changes

- 9f0271a: Analysis: `splitBands` mixes a sound to one channel and splits it in lows, mids and highs by a Linkwitz-Riley crossover (`@audio/eq-crossover`) at 250 Hz and 2.5 kHz, bands that add back to the mix, to draw each as a waveform of its own and colour a sound by its frequencies.

## 0.12.0

### Minor Changes

- 9945114: Analysis: `bandShares` reads a sound as slices and tells, for each, the share of its lows, mids and highs, to colour a waveform by its frequencies.

## 0.11.0

### Minor Changes

- eefaea5: Files: `ditherChannels` brings a sound to a bit depth by one of `DITHER_METHODS`: triangular dither, noise-shaped dither that moves the error up toward the highest frequencies, or error feedback from `@audio/effect-noiseshaper`.

## 0.10.0

### Minor Changes

- 2b5841c: Repair: a new `@audio-ui/engine/repair` module whose `repairChannels` takes a defect out of a recording, by the method made for it: clicks, crackle, mains hum at 50 or 60 Hz, steady and changing noise, clipping, wind, plosives, breaths and reverb, or `clean`, which finds what the sound carries. It is built on `@audio/denoise`.

## 0.9.0

### Minor Changes

- 4611032: Analysis: `reportSound` reads a sound once into its loudness, likeliest key, tempo and ACX verdict, and `checkAcx` tells whether it meets ACX's audiobook requirements: RMS between -23 and -18 dBFS, peak at most -3 dBFS, noise floor at most -60 dBFS on its quietest pause.

## 0.8.0

### Minor Changes

- 7d71cd7: Files: `stretchChannels` makes a sound longer or shorter at the same pitch by one of six methods (`STRETCH_METHODS`: transient-aware and phase vocoders, overlap-add for speech, a hybrid for full mixes, PaulStretch for ambient textures), `shiftChannels` moves its pitch in semitones by one of the methods of `SHIFT_METHODS`, with a formant-preserving one for voices, and `speedChannels` plays it faster or slower with its pitch moving, on `@audio/stretch` and `@audio/shift`.

## 0.7.0

### Minor Changes

- b6e52a5: Files: `normalizeChannels` brings a sound to a peak in dBFS or a loudness in LUFS under a true-peak ceiling, `panChannels` sets a stereo sound's balance, `filterChannels` runs it through a high-pass, low-pass or notch, and `gainChannels` changes its level in dB.

## 0.6.0

### Minor Changes

- 023f1ca: Files: `reverseChannels`, `repeatChannels` and `padChannels` of `@audio-ui/engine/files` play a sound from its end, put it end to end a number of times, and add silence before and after it.

## 0.5.0

### Minor Changes

- 547cdd0: Analysis: `formatHz` and `formatDb` are removed from `@audio-ui/engine/analysis`. Use `formatFrequency` and `formatLevel` of `@audio-ui/engine/format`, which write the same text with the same defaults.

## 0.4.0

### Minor Changes

- b5ff6dd: Format: a new `@audio-ui/engine/format` module writes audio quantities as text the way the standards and the tools do: levels (dBFS, dBTP, LUFS, gain), frequencies and sample rates, times, notes, pans, ratios, tempos and channel layouts. Every function takes the same options (decimals, locale, true minus, spacing, sign, unit), and `createFormatter` binds a set of defaults once.

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
