---
"@audio-ui/core": minor
---

Playback: `@audio-ui/core/playback` plays an arrangement's audio clips on the audio clock, to the frame. A `PlaybackState` counts both sides in whole frames, so a loop of any length never drifts; `TrackRenderer` is a track's player, which copies a recording bit for bit at speed 1, reads it through a cubic interpolator when warped, folds a looped clip, mirrors a reversed one, fades a stop or a jump over 2 ms, and keeps a track that heard of a play late in step; `CLIP_PLAYER_WORKLET` is that player as an AudioWorklet module, whatever the bundler. The mixer's arithmetic comes with it: `panGains` (constant power, 0 dB in the centre and +3 dB at either end, each channel on its own gain), `soloState` and `delayCompensation`.
