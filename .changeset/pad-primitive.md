---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

Pad: a new primitive for drum pads, `Pad.Root` and `Pad.Item` from `@audio-ui/react/pad`, with its framework-free controller in `@audio-ui/core/pad`. Each pad sounds while held, by pointer or with Enter or Space, and reports `onPadOn(value, eventDetails)` with a velocity taken from the pointer's pressure, or else from how high on the pad it lands. Pads sharing a `chokeGroup` stop each other, `activePads` lights pads from elsewhere, and the pads are one tab stop walked with the arrow keys.
