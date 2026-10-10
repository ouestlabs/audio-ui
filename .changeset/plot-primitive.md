---
"@audio-ui/react": minor
---

Add the Plot primitive: two axes and what is drawn on them, for equalizers, filters and compressors. Values are in your own units, and each axis can be linear, `"log"` (the way frequency is drawn) or your own `{ toPosition, toValue }`.

- **Root** owns the axes (`minX` / `maxX` / `scaleX`, and the same for y).
- **Graph** is the drawing surface, an `<svg>` stretched over the plot; **Curve** draws `y = fn(x)` across it (with `fillTo`, closed down to a value as an area), **Line** a rule at an x or y value, **Mark** a label at a value on an axis, and **Band** a shaded stretch of one axis.
- **Trace** draws a live list of y values from a `source` (a spectrum, a level history) across the x axis, painted straight in the DOM without a React render per frame, on a scale of its own with `min` / `max`; **Dot** is a point that follows a live `{ x, y }`, such as the input level on a compressor's curve.
- **Handle** is a point to drag, with a value in the axes' units and an `axis` to hold it to one of them. It moves from where it is rather than jumping to the pointer, four times finer with Shift, and holds a native `<input type="range">` per axis for the keyboard and the accessible names (`getAriaLabel`, `getAriaValueText`). Events carry `reason` (`"drag"`, `"keyboard"`, `"input-change"`) and can be cancelled.
- **useValueAtPointer** turns a pointer position into a value on the plot, to add a point where someone double-clicks.

Also exported from `@audio-ui/react/plot`.
