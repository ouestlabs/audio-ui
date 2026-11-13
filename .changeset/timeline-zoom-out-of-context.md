---
"@audio-ui/react": patch
---

Timeline: a clip, a range, a moving mark and a piano roll are no longer drawn again at each step of a zoom. The zoom is read when a gesture needs it, and only the lane, which sets the unit everything is placed with, and the viewport follow it. An arrangement of many clips zooms without re-rendering every clip's handles and fades. A zoomed clip's `--clip-unit` is now the lane's `var(--timeline-unit)`, the same length.
