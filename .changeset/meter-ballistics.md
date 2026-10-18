---
"@audio-ui/core": minor
---

Meter: `createVuBallistics` and `createPpmBallistics` give the reading a meter shows, in dB, the way a VU or a PPM meter moves: a VU meter rises and falls symmetrically, reaching 99% of a step in 300 ms, and a PPM meter rises almost at once and falls at a steady 20 dB in 1.5 seconds. They are pure: a host calls `step(level, seconds)` once per frame and draws the value it returns.
