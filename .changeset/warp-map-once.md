---
"@audio-ui/engine": patch
---

Time: `warpedTime`, `unwarpedTime` and `warpRate` make a warp's map once for its markers, not at every reading, and find a time's stretch by halves. A clip warped on every beat of a long recording, read hundreds of times a frame by its waveform and its playhead, no longer sorts its markers each time.
