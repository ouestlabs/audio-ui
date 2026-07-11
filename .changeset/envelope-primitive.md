---
"@audio-ui/react": minor
---

Add the Envelope primitive: an interactive linear ramp visualization built on SVG. `value: { x, y }[]` (normalized 0-1, consumer maps to its own time/level domain) drives a set of draggable breakpoints connected by straight segments. Compound parts (`Root`, `Svg`, `Path`, `Fill`, `Points`, `Point`) render the polyline and per-point handles. Points can be added by double-clicking empty space and removed by double-clicking a point or pressing Delete/Backspace on the focused one — dragging only ever moves a point, never deletes it. A point's x is clamped between its neighbors so points can never cross or reorder mid-drag. Keyboard support follows the same roving-tabindex pattern as the other primitives.
