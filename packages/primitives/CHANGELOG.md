# @audio-ui/primitives

## 0.1.1

### Patch Changes

- 0521150: The web adapters of the knob, the fader, the XY pad, the meter, the pad, the piano, the sequencer, the envelope, the plot, the piano roll, the waveform and the timeline read their value and their drawing from the primitive's own state, now written on the UI SDK number helpers and drag. A knob and the axes of a plot take a `{ to, from }` pair as a custom scale. Each channel of a meter is named by its own label. A quick stroke on the sequencer, or a paint stroke on the piano roll, paints every cell it crosses. A waveform region commits the region it just reported, as a plot handle does. A plot handle commits the value it just reported, even before a controlled value comes back.

## 0.1.0

### Minor Changes

- e115e71: First release. The behavior of the twelve primitives (envelope, fader, knob, meter, pad, piano, piano roll, plot, sequencer, timeline, waveform, XY pad), written once and rendered in React, Vue, Svelte and the web by the adapters of the audio/ui registry.
