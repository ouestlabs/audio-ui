---
"@audio-ui/engine": minor
---

Files: `stretchChannels` makes a sound longer or shorter at the same pitch by one of six methods (`STRETCH_METHODS`: transient-aware and phase vocoders, overlap-add for speech, a hybrid for full mixes, PaulStretch for ambient textures), `shiftChannels` moves its pitch in semitones by one of the methods of `SHIFT_METHODS`, with a formant-preserving one for voices, and `speedChannels` plays it faster or slower with its pitch moving, on `@audio/stretch` and `@audio/shift`.
