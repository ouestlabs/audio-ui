---
"@audio-ui/primitives": patch
---

The web adapters of the knob and the fader read their value and their drawing from the primitive's own state, now written on the UI SDK number helpers and drag. A knob takes a `{ to, from }` pair as a custom scale.
