---
title: One controller per control, created once
impact: HIGH
impactDescription: drags, focus and the uncontrolled value survive option changes
tags: core, controller, vue, svelte, lifecycle
---

## One controller per control, created once

A controller holds the gesture in flight and, when uncontrolled, the value. Recreating it whenever an option changes (a reactive block, a computed, a re-render) drops the drag under the pointer and resets the value. Create it once per mounted control and hand it new options with `setOptions`.

**Incorrect (a new controller on every change):**

```ts
// Vue
const knob = computed(() => createKnobController({ max: props.max, min: props.min }));
```

**Correct (created once, options updated):**

```ts
// Vue
const knob = createKnobController();
watchEffect(() => {
  knob.setOptions(options());
  sync();
});
```

Every primitive follows the same shape: `create<Name>Controller` from `@audio-ui/core/<name>` (`createKnobController`, `createFaderController`, `createXYPadController`, `createSequencerController`…).
