---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

Timeline: Delete or Backspace on a `Timeline.ClipFadeHandle` takes its fade away, and nothing else hears the key. While a fade is dragged, the clip says which with `data-fading` (`"in"` or `"out"`), and it always sets `--clip-fade-in-max` and `--clip-fade-out-max`, how long each fade can grow, so the limit can be drawn. The core clip snapshot gains `dragTarget`, what a pointer is dragging.
