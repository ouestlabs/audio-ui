---
"@audio-ui/react": minor
---

Add the Envelope primitive: an interactive breakpoint envelope built on SVG. `value: { x, y }[]` (normalized 0-1, the consumer maps it to its own time/level domain) drives a set of draggable points connected by straight segments.

- Parts: `Root`, `Graph` (the SVG surface), `Line` and `Fill` (the curve and the area under it), `Points` (one child per point) and `Point` (the draggable handle). Every part takes a `render` prop and state-aware `className`/`style`; points expose `data-dragging`, `data-removable`, `data-blocked`, `data-disabled` and `data-index`.
- Points are added by double-clicking the graph and removed by double-clicking a point or pressing Delete/Backspace on the focused one, within `minPoints` / `maxPoints` (equal values fix the shape); a refused action sets `data-blocked` briefly. Dragging only ever moves a point, and its x is clamped between its neighbors so points can never cross or reorder.
- `onValueChange(points, eventDetails)` / `onValueCommitted(points, eventDetails)`, with `eventDetails.reason` (`"drag"`, `"keyboard"`, `"add"`, `"remove"`), `eventDetails.index` and `eventDetails.cancel()`. A dragged point follows the pointer even if a controlled `value` lags behind.
- Keyboard: one roving tab stop; arrows nudge the focused point by `step` (Shift for ten steps). Each `Point` is a `role="slider"`: name it with `aria-label` and map its coordinates to real units with `getAriaValueText` (or `format`/`locale` on `Root`).
