---
"@audio-ui/elements": minor
---

`<audio-ui-piano-roll>`: breaking, the `scale` attribute lists the scale's pitch classes, such as `scale="0 2 4 5 7 9 11"` for a major scale, in place of its name, and the `scale` property takes `{ pitchClasses, root }`. `scale-root` is unchanged.
