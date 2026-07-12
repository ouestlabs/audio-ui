---
"@audio-ui/react": minor
---

Add the PianoRoll primitive: an editable note grid in the FL Studio/Ableton Live tradition. `value: { id, note, startStep, duration, velocity? }[]` — time is expressed in integer grid steps and pitch in MIDI note numbers, so real-world timing (BPM, seconds) stays a consumer concern, same as Sequencer's step-indexed model.

Compound parts: `Root`, `Grid`, `Notes`/`Note`, `NoteHandle`, `Playhead`, and `KeysTrack`/`Keys`/`Key` for an optional vertical pitch-reference strip beside the grid.

- **Note editing**: click empty grid space for a 1-step note, or drag to paint one spanning several steps in either direction from where the press landed. Drag a note to move it (hold Alt/Option while dragging to move a copy instead, leaving the original in place — works on a whole selection group too), drag either `NoteHandle` to resize from that edge, double-click to remove. A 4px movement threshold gates every drag start (move, resize, paint) so a plain click never gets misread as a drag.
- **Multi-select**: shift-click toggles a note into/out of the selection; dragging, resizing, nudging, or deleting any selected note acts on the whole group, clamped by its most-restrictive member so the group never visually compresses at an edge.
- **Keyboard**: arrow keys nudge the focused note (or selection) by a step/semitone, Shift+Left/Right resizes it, Delete/Backspace removes it, and Enter on the grid itself adds a note at a default position for keyboard-only creation. `Note` elements use a plain `tabIndex={0}` rather than the roving `-1`/`0` pattern the other primitives use — notes are a sparse, dynamically-sized collection, not a fixed-size set — and render in spatial (not insertion) order so Tab moves left-to-right through the timeline. The grid carries `aria-multiselectable`.
- **Key strip**: `KeysTrack` owns pointer capture for glissando (dragging across rows retriggers each key) and multi-touch; `Key` lights up (`data-active`) from pointer presses or an external `activeNotes` overlay (MIDI input, a note being edited on the grid).
- **`Playhead`** is a purely decorative positioned marker meant to be driven imperatively via `ref` from a consumer's own animation-frame scheduling loop, since playback position updates far too fast for React state.
