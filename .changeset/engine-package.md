---
"@audio-ui/engine": minor
---

First release: the audio logic behind the controls, with no UI framework in it. `device`, `time`, `analysis`, `midi`, `pitch` and `playback`, which were subpaths of `@audio-ui/core`, are its modules, with the same exports. `pitch` keeps the named scales and adds `rollScale`, a scale as the piano roll reads it, `detectKeys`, `midiToHz` and `cents`. What the registry built on audio.js is in it too: `files` (audio decoding and encoding, MIDI and MusicXML files), `worklet` (`loadWorklet`), the engine contracts, worklet stages, feeds, noise and measurements in `device`, and loudness, `detectPitch`, `analyzeBeat` and `audioChroma` in `analysis`. The devices' audio.js is the engine's as well: `kernels`, the code each device's worklet runs, and `dsp`, the models, gain curves, filter circuits and reverbs their descriptions use.
