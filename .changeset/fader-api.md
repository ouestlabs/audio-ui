---
"@audio-ui/react": minor
---

Rework the `Fader` API. Requires the `@base-ui/react` ^1.9.0 peer dependency. **Breaking (pre-1.0):**

- Parts: `Root`, `Label`, `Value`, `Control` (was `Slider`), `Track`, `Indicator` (was `Range`), `Thumb`. The decorative `ThumbInner`/`ThumbMark` parts are gone — render your own elements inside `Thumb`.
- Types live on each part: `Fader.Root.Props`, `Fader.Root.State`, `Fader.Root.ChangeEventDetails`, … (was `Fader.RootProps`).
- `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` (was `onValueCommit(value)`), with `eventDetails.reason` (`"drag"`, `"track-press"`, `"keyboard"`, `"wheel"`, …) and `eventDetails.cancel()`.
- The accessible name goes on `Thumb` (`aria-label` / `aria-labelledby`), which now renders a native `<input type="range">`. Disabled state is the presence attribute `data-disabled`.

New: the `render` prop and state-aware `className`/`style` on every part, handler merging, `name`/`form` integration, `format`/`locale` with a formatted `Fader.Value` and `aria-valuetext`, `largeStep` (Shift+Arrow), RTL. Kept: vertical -60…+6 defaults, mouse-wheel stepping, and `touch-action: none` on `Control`. While dragged, the thumb always follows the pointer even if a controlled `value` lags behind (reject values with `eventDetails.cancel()`).
- New `anchor`: the value `Indicator` fills from, such as `0` on a -1…1 pan, on whichever side of it the value is.
- New `Mark`: a graduation along the track at a value, with `data-active` once the value has reached it from the anchor, and `data-orientation`.
