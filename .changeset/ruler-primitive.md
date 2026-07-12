---
"@audio-ui/react": minor
---

Add the Ruler primitive: a timeline strip for click-to-seek and drag-to-set loop regions above a step-indexed grid (PianoRoll, Sequencer). `value: { start, end } | null` — a step range with `end` exclusive, null meaning no region is set.

Compound parts: `Root`, `Track`, `LoopRegion`, `LoopRegionHandle`, and `Playhead`.

- **Seek vs. region**: a plain click on `Track` (press-release under the 4px drag threshold) fires `onSeek(step)`; dragging past the threshold draws a loop region spanning the dragged steps instead, extending from the anchor in either direction like PianoRoll's paint mode.
- **Editing an existing region**: drag `LoopRegion`'s body to move it, drag either `LoopRegionHandle` to resize from that edge, double-click the body or press Delete/Backspace while it's focused to clear it back to "no region."
- **Keyboard**: arrow keys nudge the focused region by a step, Shift+Left/Right resizes its end edge, and Enter on `Track` creates a default region for keyboard-only use. `LoopRegionHandle` is a pointer-only affordance and stays out of the accessibility tree, the same split PianoRoll's `NoteHandle` uses for its start edge.
- **`Playhead`** is a purely decorative positioned marker meant to be driven imperatively via `ref` from a consumer's own animation-frame scheduling loop, same contract as `PianoRoll.Playhead`.
