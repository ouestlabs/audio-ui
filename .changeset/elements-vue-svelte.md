---
"@audio-ui/elements": minor
---

Template types for Vue and Svelte. `import type {} from "@audio-ui/elements/vue"` adds every element to Vue's `GlobalComponents`, and `import type {} from "@audio-ui/elements/svelte"` to `SvelteHTMLElements`: each element's attributes, the properties it has a setter for, and its events with the type of their `detail`. `vue` and `svelte` are optional peer dependencies.

A root's `value` reads the value proposed while its `input` event is dispatched, as a native input's does, so `event.target.value` is the new value and Vue's `v-model` binds an element. A refused value is read only during its event.

The events of the timeline's clips, lanes, rulers, marks, ranges and tracks, and of the waveform's control and regions, are typed: each part has an event map (`TimelineClipElementEventMap`, `WaveformRegionElementEventMap`…) and a typed `addEventListener`.
