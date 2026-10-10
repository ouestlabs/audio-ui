---
"@audio-ui/react": minor
---

Piano: `onNoteOn` now carries a `velocity`, from 0.25 to 1, in its event details. A pointer press near the free end of a key plays harder than one near its top, as on a real keyboard; a key pressed from the keyboard plays at 0.8.

Knob, Fader and XYPad return to their default value (`defaultValue`, or the middle) on a double click, an Alt + click or the Delete key, reporting `reason: "reset"`. Meter: a live clip stays lit as `data-clipped` until a click on the meter clears it.
