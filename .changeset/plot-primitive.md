---
"@audio-ui/react": minor
---

Add the Plot primitive: two axes and what is drawn on them, for equalizers, filters and compressors. Values are in your own units, and each axis can be linear, `"log"` (the way frequency is drawn) or your own `{ toPosition, toValue }`.

- **Root** owns the axes (`minX` / `maxX` / `scaleX`, and the same for y).
- **Graph** is the drawing surface, an `<svg>` stretched over the plot; **Curve** draws `y = fn(x)` across it (with `fillTo`, closed down to a value as an area), **Line** a rule at an x or y value, and **Band** a shaded stretch of one axis.
- **Handle** is a point to drag, with a value in the axes' units and an `axis` to hold it to one of them. It moves from where it is rather than jumping to the pointer, four times finer with Shift, and holds a native `<input type="range">` per axis for the keyboard and the accessible names (`getAriaLabel`, `getAriaValueText`). Events carry `reason` (`"drag"`, `"keyboard"`, `"input-change"`) and can be cancelled.

Also exported from `@audio-ui/react/plot`.
