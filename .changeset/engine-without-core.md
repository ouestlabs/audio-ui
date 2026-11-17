---
"@audio-ui/engine": minor
---

The engine no longer depends on `@audio-ui/core`. It has its own `Note` and `NoteId` (`@audio-ui/engine/playback`), `FadeShape` and `fadeGain` (`@audio-ui/engine/playback`), `RollScale` (`@audio-ui/engine/pitch`), and the parameter scales `ParameterScale`, `ParameterScaleProp`, `resolveScale`, `LINEAR_SCALE` and `LOGARITHMIC_SCALE` (`@audio-ui/engine/device`). The shapes are the same as before, so code that passed core's values keeps working.
