---
"@audio-ui/core": minor
---

Meter: `createVuBallistics` now moves the way the VU standard says. The reading follows the voltage of the level, as a pointer does, and first reaches 99% of a step in 300 ms with a 1.3% overshoot and no more, where it was a plain smoothing in dB with no overshoot. `vuDeflection` is new: it gives the position of a mark on a VU dial, which follows the voltage and not the dB, so with `levelPosition` from `Number.NEGATIVE_INFINITY` to +3, 0 VU sits at 71% of the scale and -20 VU at 7%.
