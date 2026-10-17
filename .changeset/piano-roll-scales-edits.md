---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

PianoRoll: scales and note edits. `@audio-ui/core/pitch` gets the scales (`SCALES`, `inScale`, `nearestInScale`, `scalePitchClasses`), and `@audio-ui/core/piano-roll` the edits a toolbar or a menu applies to a selection: `splitNotes` (at a time, or at every grid line to chop), `chopNotes`, `joinNotes`, `legatoNotes`, `reverseNotes`, `invertNotes`, `stretchNotes`, `fitNotesToScale`, `rampVelocity` and `humanizeNotes`. The roll takes a `scale`, marking its rows with `data-in-scale`, and `folded="scale"` keeps only those rows and the ones carrying notes.

PianoRoll: a note can be deactivated (`muted`) and given a `chance` to play, shown as `data-muted` on a note and its velocity bar and as the `--piano-roll-chance` CSS variable; `toggleMuted`, `setChance` and `selectionSpan` go with them. The root says when notes are selected (`data-has-selection`), and the new `PianoRoll.SelectionSpan` shades the time the selection covers in the grid, the velocity lane or a ruler.
