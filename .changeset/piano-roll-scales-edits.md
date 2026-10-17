---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

PianoRoll: scales and note edits. `@audio-ui/core/pitch` gets the scales (`SCALES`, `inScale`, `nearestInScale`, `scalePitchClasses`), and `@audio-ui/core/piano-roll` the edits a toolbar or a menu applies to a selection: `splitNotes` (at a time, or at every grid line to chop), `chopNotes`, `joinNotes`, `legatoNotes`, `reverseNotes`, `invertNotes`, `stretchNotes`, `fitNotesToScale`, `rampVelocity` and `humanizeNotes`. The roll takes a `scale`, marking its rows with `data-in-scale`, and `folded="scale"` keeps only those rows and the ones carrying notes.
