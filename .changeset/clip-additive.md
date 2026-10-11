---
"@audio-ui/react": minor
---

`Timeline.Clip` takes `additive`: every press on it is reported to `onSelectedChange`, as one with Shift, Cmd or Ctrl held is, so a selection can be built where there are no modifier keys, such as a touch screen.
