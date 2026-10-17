---
"@audio-ui/core": minor
"@audio-ui/react": patch
---

Envelope: a bent segment is now the exponential of an analog envelope stage, `(e^(k·t) - 1) / (e^k - 1)` with `k = curve × CURVE_RATE`, instead of a power of `t`. A curve and its opposite are mirror images, and neither turns vertical at an end: a curve of -1 used to show as a wall with a sharp elbow at the start of its segment. At ±1 the middle of the segment sits where it did before (0.4% or 99.6% of the rise), and a drag on a segment's handle still lands the midpoint under the pointer, now reaching the full curve at the edges. `CURVE_EXPONENT_RANGE` is replaced by `CURVE_RATE` (11). A saved `curve` keeps its sign and roughly its strength, but its shape between the ends changes.
