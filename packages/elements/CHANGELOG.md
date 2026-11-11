# @audio-ui/elements

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
