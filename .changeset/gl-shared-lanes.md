---
"@audio-ui/gl": minor
---

Waveform: `createWaveformLane(canvas, inputs, { shared: true })` draws on the page's one WebGL context and copies the picture onto `canvas`, a 2D canvas, so a page draws as many lanes as it has clips, past the sixteen contexts a browser keeps; lanes reading one recording share what is on the GPU for it. `zoom` may be left out for a lane that fits its clips to its box, and a clip's `peak` for the lane to read it from its leaves or its samples. Lane: a lane scrolled out of sight up or down draws nothing until it comes near. A lane's own context is let go of when the lane is destroyed (`releaseContext`, kept by `keepContext` for a lane started again on the same canvas), and `hasWebGL2` asks once and lets its probe go, so a page that mounts lanes often never loses one it draws on.
