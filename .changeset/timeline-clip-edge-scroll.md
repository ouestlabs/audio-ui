---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

Timeline: a clip moved or trimmed with the pointer held near an edge of `Timeline.Viewport` scrolls it, and stays under the pointer while it does, so a clip can be taken past what is on screen; a move also scrolls down to the lanes below. Off the lanes, over a track header, the ruler or past the last lane, a moved clip goes to the nearest lane instead of staying where it was. `Timeline.Viewport` marks itself with `data-timeline-viewport`, which the clips find it by.
