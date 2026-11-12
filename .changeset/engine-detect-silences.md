---
"@audio-ui/engine": minor
---

Analysis: `detectSilences(channels, sampleRate, options?)` finds where a recording pauses between its sounds, as `[from, to]` in seconds: each stretch of at least 60 ms where every sample stays under -34 dBFS, or 20 dB under the loudest sample of a quiet recording, with the threshold and the shortest pause of your own.
