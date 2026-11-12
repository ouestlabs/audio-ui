# @audio-ui/elements

## 0.5.0

### Minor Changes

- 5e441c4: Template types for Vue and Svelte. `import type {} from "@audio-ui/elements/vue"` adds every element to Vue's `GlobalComponents`, and `import type {} from "@audio-ui/elements/svelte"` to `SvelteHTMLElements`: each element's attributes, the properties it has a setter for, and its events with the type of their `detail`. `vue` and `svelte` are optional peer dependencies.
  
  A root's `value` reads the value proposed while its `input` event is dispatched, as a native input's does, so `event.target.value` is the new value and Vue's `v-model` binds an element. A refused value is read only during its event.
  
  The events of the timeline's clips, lanes, rulers, marks, ranges and tracks, and of the waveform's control and regions, are typed: each part has an event map (`TimelineClipElementEventMap`, `WaveformRegionElementEventMap`…) and a typed `addEventListener`.

### Patch Changes

- Updated dependencies [5e441c4]
  - @audio-ui/core@0.29.1

## 0.4.0

### Minor Changes

- 04a9fae: `<audio-ui-piano-roll>`: breaking, the `scale` attribute lists the scale's pitch classes, such as `scale="0 2 4 5 7 9 11"` for a major scale, in place of its name, and the `scale` property takes `{ pitchClasses, root }`. `scale-root` is unchanged.

### Patch Changes

- Updated dependencies [04a9fae]
- Updated dependencies [04a9fae]
  - @audio-ui/core@0.29.0

## 0.3.0

### Minor Changes

- a332f1d: `<audio-ui-piano-roll-row>` carries `data-out-of-scale` on the rows not in the roll's scale.

## 0.2.0

### Minor Changes

- 48b8920: `<audio-ui-piano-roll-row>` carries `data-scale-root` on the rows of the root of the roll's scale.

### Patch Changes

- Updated dependencies [48b8920]
  - @audio-ui/core@0.28.0

## 0.1.3

### Patch Changes

- Updated dependencies [0453b7a]
- Updated dependencies [0453b7a]
  - @audio-ui/core@0.27.0

## 0.1.2

### Patch Changes

- Updated dependencies [7c53f71]
- Updated dependencies [7c53f71]
- Updated dependencies [7c53f71]
  - @audio-ui/core@0.26.0

## 0.1.1

### Patch Changes

- Updated dependencies [205d843]
  - @audio-ui/core@0.25.0

## 0.1.0

### Minor Changes

- 718e188: New package: every primitive as framework-agnostic Web Components, built on `@audio-ui/core` and at API parity with `@audio-ui/react`, with the same parts, keyboard interactions, ARIA semantics and `data-*` state attributes. Controls fire `input` on every change, cancelable with `preventDefault()`, and `change` when an interaction ends; parts with a value of their own fire prefixed events, such as `clipinput` and `clipchange`. Each primitive registers from its own entry point, `@audio-ui/elements/<primitive>`.

### Patch Changes

- Updated dependencies [718e188]
  - @audio-ui/core@0.24.0
