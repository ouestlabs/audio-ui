---
"@audio-ui/gl": minor
---

Lane: a lane draws a change of its inputs and a resize at once, in the frame they happen, when its renderer is loaded and its samples are at hand: a zoom shows the waveform or the spectrogram at the new width with the lane, never a frame late. `visibleClipsNow` gives the clips in view when every recording hands its samples at once; a lane waits only for what it does not hold yet. The waveform lane sets `data-detail` on its canvas (`columns`, or `line` once a sample is wider than a pixel). A lane reads each recording once and keeps it (`SampleCache`, `readOnce`), since a reader may copy or mix the whole recording each time it is asked: before, a lane read it again at every paint.
