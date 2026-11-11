---
"@audio-ui/engine": minor
---

First release: the audio logic behind the controls, with no UI framework in it. `device`, `time`, `analysis`, `midi`, `pitch` and `playback`, which were subpaths of `@audio-ui/core`, are its modules, with the same exports. `pitch` keeps the named scales and adds `rollScale`, a scale as the piano roll reads it.
