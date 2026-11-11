---
"@audio-ui/core": minor
---

Core holds the logic of the controls only, with no dependency. Breaking: the `analysis`, `device`, `midi`, `pitch`, `playback` and `time` subpaths moved to `@audio-ui/engine`, under the same names and with the same exports: import them from `@audio-ui/engine/<module>`. `pitchName`, `pitchClassName` and `isBlackKey` are exported by the root. The piano roll's `scale` option, `rollRows`, `fitNotesToScale` and the `scale` query of `findNotes` take a `RollScale`, `{ pitchClasses, root }`, in place of a named scale; `rollScale` of `@audio-ui/engine/pitch` gives a named scale in that shape.
