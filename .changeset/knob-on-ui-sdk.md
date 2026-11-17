---
"@audio-ui/primitives": patch
---

The web adapters of the knob, the fader, the XY pad, the meter and the pad read their value and their drawing from the primitive's own state, now written on the UI SDK number helpers and drag. A knob takes a `{ to, from }` pair as a custom scale. Each channel of a meter is named by its own label.
