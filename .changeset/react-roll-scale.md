---
"@audio-ui/react": minor
---

PianoRoll: breaking, `scale` takes a `RollScale`, `{ pitchClasses, root }`, in place of a named scale such as `{ name: "major", root: 0 }`. `rollScale` of `@audio-ui/engine/pitch` gives a named scale in that shape.
