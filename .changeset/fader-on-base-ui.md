---
"@audio-ui/react": minor
---

Rebuild `Fader` on Base UI's `Slider` (new peer dependency: `@base-ui/react` ^1.9.0). **Breaking (pre-1.0):**

- Parts follow Base UI: `Root`, `Label`, `Value`, `Control` (was `Slider`), `Track`, `Indicator` (was `Range`), `Thumb`. The decorative `ThumbInner`/`ThumbMark` parts are gone — render your own elements inside `Thumb`.
- Types follow Base UI: `Fader.Root.Props`, `Fader.Root.State`, `Fader.Root.ChangeEventDetails`, … (was `Fader.RootProps`).
- `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` (was `onValueCommit(value)`), with `eventDetails.reason` (`"drag"`, `"track-press"`, `"keyboard"`, `"wheel"`, …) and `eventDetails.cancel()`.
- The accessible name goes on `Thumb` (`aria-label` / `aria-labelledby`), which now renders a native `<input type="range">`. Disabled state is the presence attribute `data-disabled`.

New from Base UI: the `render` prop and state-aware `className`/`style` on every part, handler merging, `name`/`form` integration, `format`/`locale` with a formatted `Fader.Value` and `aria-valuetext`, `largeStep` (Shift+Arrow), RTL. Kept from audio/ui: vertical -60…+6 defaults, mouse-wheel stepping, `freezeWhileDragging`, and `touch-action: none` on `Control`.
