---
"@audio-ui/react": minor
---

Rework the `Knob` API to match `Fader`. **Breaking (pre-1.0):**

- Parts: `Root`, `Control` (was `Slider`: pointer drag, wheel, double-tap reset), `Track` and `Indicator` (the rail and value arcs, was `Arc`), `Thumb` (rotates with the value, was `Body` + the needle `Indicator`), plus new `Value` and `Label`. Draw your own pointer inside `Thumb`.
- `dragMode: "circular" | "vertical" | "revolution"` replaces `dragSensitivity` and `dragOptions` (and its seven tuning thresholds). `"vertical"` is now a pure up/down drag.
- The geometry props (`angleGapRad`, `angleOffset`, `angleRange`, `arcRadius`, `arcStrokeWidth`, `indicatorSpan`, `indicatorWidth`) are gone; `Track`/`Indicator` take a `strokeWidth`.
- `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` (was `onValueCommit(value)`), with `eventDetails.reason` (`"drag"`, `"keyboard"`, `"wheel"`, `"reset"`, `"input-change"`) and `eventDetails.cancel()`.
- The accessible name goes on `Thumb` (`aria-label` / `aria-labelledby`), which now renders a native `<input type="range">` (`name`/`form`, `aria-valuetext` from `format`/`locale` or `getAriaValueText`). Without a name, the knob is no longer labelled "Knob" automatically.
- Every part takes a `render` prop and state-aware `className`/`style`, and exposes `data-disabled` / `data-dragging`. `largeStep` (default 10) drives Page Up/Down and Shift+Arrow keys.
- New `scale`: `"linear"` (default), `"log"` for frequency, Q and ratios (every decade the same share of the dial; needs a positive `min`), or your own `{ toPosition, toValue }`. Drags move along the dial's travel; away from linear, keys and the wheel move 1% of it (10% with Shift and Page keys), always by at least one `step`. Without a `defaultValue`, the knob starts and resets at the middle of its travel.
- Holding Shift while dragging, in any `dragMode`, turns the knob four times slower; small moves add up rather than rounding away.
