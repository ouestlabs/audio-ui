---
"@audio-ui/react": minor
---

Knob and Fader: `Value` takes `editable`. A double click on the readout, or Enter while it has focus, swaps it for a text field holding the value; Enter or leaving the field commits what was typed, Escape drops it. A unit or a decimal comma is fine ("-6 dB", "12,5"), the number is rounded to `step` and clamped, and it is reported with `reason: "input-change"`. The readout takes the pointer events it receives, so inside a thumb it does not also drag or reset.
