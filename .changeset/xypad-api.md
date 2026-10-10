---
"@audio-ui/react": minor
---

Rework the `XYPad` API to match `Fader` and `Knob`. **Breaking (pre-1.0):**

- Parts: `Root`, `Control` (was `Slider`: press, drag, wheel), `Thumb` (was `Cursor`), `Value` (was `ValueDisplay`) and `Label`. The decorative parts (`Grid`, `GridLine`, `Crosshair`, `CursorGlow`, `CursorDot`, `CursorHighlight`) are gone: draw grids and crosshairs with your own elements and the new `--xy-pad-x` / `--xy-pad-y` CSS variables.
- `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` (was `onValueCommit(value)`), with `eventDetails.reason` (`"press"`, `"drag"`, `"keyboard"`, `"wheel"`, `"input-change"`) and `eventDetails.cancel()`.
- `Thumb` renders one native `<input type="range">` per axis, named from `aria-label` ("… X" / "… Y") or `getAriaLabel(axis)`. The pad no longer injects an English "XY Pad" label, usage instructions, or a live status region.
- `defaultValue` now defaults to the center of the pad (was the bottom-left corner). `Home` / `End` move X to its min / max (were the top-left / bottom-right corners); `Shift` + arrows move 10 steps. The wheel follows the scroll direction: up raises Y, right raises X.
- Every part takes a `render` prop and state-aware `className`/`style`, and exposes `data-disabled` / `data-dragging`. `format`/`locale` feed `XYPad.Value` and each input's `aria-valuetext`.

Also: `Fader`, `Knob` and `XYPad` treat a non-finite controlled value (`NaN`, `±Infinity`) as `min`; `Knob` and `XYPad` commit whenever a pointer gesture changed the value, even if it ends back on its starting value.
