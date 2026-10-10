---
"@audio-ui/react": minor
---

Add the PianoRoll primitive: notes on a timeline, edited by pointer and keyboard. It sits inside a `Timeline.Root`, which gives it its length, zoom, grid and position, so a note's `start` and `length` are in the timeline's units (steps, beats, pulses) and every gesture lands on its grid unless Cmd/Ctrl is held. A note is `{ id, pitch, start, length, velocity? }`.

Parts: `Root`, `Grid` (a timeline lane), `Rows` / `Row`, `Notes` / `Note`, `NoteHandle`, `Marquee`, and `Keys` / `Key` / `KeyLabel` for the keyboard down the side.

- **Rows:** from `maxPitch` at the top to `minPitch`; with `folded`, only the pitches carrying notes get a row. `--piano-roll-rows` on the root counts them, so the grid and the keys can be sized per row, and every row-placed part sets `--piano-roll-row`. `Row` bands a pitch across the grid with `data-color`, `data-octave` (a C) and `data-active`.
- **Drawing:** with `mode="draw"`, a press on empty grid adds a note of the length last drawn or resized, and its end follows the pointer. With `mode="select"` (the default), the press drags a selection rectangle (`Marquee`), Shift adding to the selection, and a double-click draws. Focused, the grid adds a note at the playback position with Enter, clears the selection with Escape and selects everything with Cmd/Ctrl+A.
- **Editing:** dragging a note moves it, and the rest of the selection with it, keeping a chord's shape; with Alt the drag carries copies off. A `NoteHandle` per edge resizes it, the start trimming it from the front. Shift + click toggles a note in the selection, a double-click removes it. Notes are toggle buttons (`aria-pressed` for selected) in reading order: the arrow keys move them (Up and Down by a semitone, an octave with Shift), Shift + Left/Right changes their length, Enter or Space selects, Delete removes.
- **Events:** `onValueChange` / `onValueCommitted` carry `reason` (`"draw"`, `"drag"`, `"keyboard"`, `"double-click"`) and `edit` (`"add"`, `"move"`, `"resize"`, `"duplicate"`, `"remove"`). The selection is controlled or not (`selection`, `onSelectionChange`). While a gesture edits the notes they follow the pointer even when a controlled `value` lags.
- **Sound:** `onNoteOn(pitch, eventDetails)` / `onNoteOff` say when to audition a pitch: a key pressed, a note drawn, picked up or moved to a new pitch. `activePitches` lights keys and rows from elsewhere, such as the notes playing.
- **Keys:** a `Piano` laid out on the roll's rows. Shift + press (or Shift + Enter) selects every note on a row.
