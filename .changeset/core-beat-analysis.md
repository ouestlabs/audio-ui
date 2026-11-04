---
"@audio-ui/core": minor
---

Analysis: `detectTransients` finds where a recording's notes and beats begin, to the sample, and `estimateTempo` reads the tempo they keep (60 to 200 BPM, the octave nearest 120) and where its first beat falls, or `null` when there is no steady beat. `autoWarp` turns that into the warp markers that play a file in time at an arrangement's tempo: a short file that 1, 2, 4, 8 or 16 bars fit, as that loop; any other with a marker on the first beat of each bar, moved onto the nearest transient.
