---
"@audio-ui/primitives": patch
---

The web adapters of the knob, the fader, the XY pad, the meter, the pad, the piano, the sequencer, the envelope and the plot read their value and their drawing from the primitive's own state, now written on the UI SDK number helpers and drag. A knob and the axes of a plot take a `{ to, from }` pair as a custom scale. Each channel of a meter is named by its own label. A quick stroke on the sequencer paints every cell it crosses. A plot handle commits the value it just reported, even before a controlled value comes back.
