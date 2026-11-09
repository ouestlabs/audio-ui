---
"@audio-ui/core": patch
---

Analysis: `detectTransients` and `estimateTempo` read each sample about twice instead of eight times, summing each hop once and each window from its hops, so a 15-minute recording is read in a fifth of the time. They find the same transients and the same tempo as before.
