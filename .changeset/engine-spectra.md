---
"@audio-ui/engine": minor
---

Analysis: `spectrogramSpectra` sums up a recording as spectra for a spectrogram drawn on the GPU that does not hold it, a column every `hop` frames, each bin's level as a byte, over the short-time transform of `@audio/stft`. It reads any reader a stretch at a time, so it runs in a worker over a file. `@audio/stft` is now a dependency of its own.
