---
"@audio-ui/core": minor
---

Playback: a clip can stretch time without changing its pitch. `warpMode` is `"repitch"`, the default and what a clip played until now, `"beats"`, slices that each play at their own speed so an attack keeps its shape (`warpGrain` sets their length), or `"tones"`, overlapping grains lined up on each other so a held note keeps its pitch and level. In those two, `transpose` plays the clip that many semitones from its pitch at the speed it has. A clip with no warp and no transpose is still copied as it is, in any mode.

A streamed recording read between its frames finds its page once for the four points it interpolates, rather than four times: a stretched or repitched clip read from a stream costs less on the audio thread.
