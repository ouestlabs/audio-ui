---
"@audio-ui/core": minor
---

Removes `estimateTempo` from `@audio-ui/core/analysis`: `@audio/beat-detect` reads the tempo, and the registry's `analyzeBeat` fits its grid to `detectTransients`. `TempoEstimate`, `detectTransients` and `autoWarp` are unchanged.
