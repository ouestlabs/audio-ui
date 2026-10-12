---
"@audio-ui/react": minor
---

Rebuild the Sequencer primitive: a grid of steps, a row per sound (`value: boolean[][]`). Parts: `Root`, `Rows`, `Row` (named with `aria-label`), `Cells` and `Cell`, each step a toggle button with `aria-pressed`.

- **Pointer:** a press flips a step and dragging on paints the new state across every step the pointer crosses, found from the cells' own boxes.
- **Keyboard:** the steps are one tab stop; the arrow keys, Home and End (with Ctrl or Cmd, the corners of the grid) move between them, and Space or Enter flips one.
- **Events:** `onValueChange(value, eventDetails)` with `reason` `"press"`, `"paint"` or `"keyboard"`, cancellable; `onValueCommitted` when a gesture that changed the pattern ends.
- **Playhead:** `source`, the step being played as a live value, sets `data-current` on its cells straight in the DOM without re-rendering React; this replaces the `activeStep` prop.

Also exported from `@audio-ui/react/sequencer`.
