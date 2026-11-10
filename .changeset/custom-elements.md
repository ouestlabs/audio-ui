---
"@audio-ui/elements": minor
---

A new package: the knob and the fader as custom elements, `<audio-ui-knob>` and `<audio-ui-fader>`, for a page in plain HTML, Vue, Svelte or any framework that renders HTML. They are the same parts as the React primitives, built on `@audio-ui/core`, with the same keys, drag and wheel, a native range input in each thumb, and the same data attributes to style from. Every change fires an `input` event, which `preventDefault()` refuses, and a gesture that ends fires a `change`; the `value` property reads and moves the control. Importing `@audio-ui/elements/knob` or `@audio-ui/elements/fader` registers its elements.
