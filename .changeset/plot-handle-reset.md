---
"@audio-ui/react": minor
---

Plot: a `Plot.Handle` returns to its `defaultValue` (or the middle of the plot) on a double click, an Alt + click or the Delete key, along the axes it moves along, reporting `reason: "reset"` to `onValueChange` and `onValueCommitted`, like Knob, Fader and XYPad.
