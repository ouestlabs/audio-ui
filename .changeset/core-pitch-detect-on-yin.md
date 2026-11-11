---
"@audio-ui/core": minor
---

Removes `detectPitch` and its types from `@audio-ui/core/pitch`: use `yin` from `@audio/pitch-yin`, which returns `{ freq, clarity }`. A level gate is yours to add.
