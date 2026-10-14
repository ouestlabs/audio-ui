---
title: Tear down what you attach
impact: MEDIUM
impactDescription: no listeners or redraws on unmounted controls
tags: core, cleanup, lifecycle
---

## Tear down what you attach

`subscribe` and `attachWheel` return their own removers. A control unmounted without them keeps redrawing a detached node and swallowing wheel events.

**Incorrect:**

```ts
knob.subscribe(render);
knob.attachWheel(control);
control.addEventListener("pointerdown", onPointerDown);
```

**Correct:**

```ts
const unsubscribe = knob.subscribe(render);
const detachWheel = knob.attachWheel(control);
control.addEventListener("pointerdown", onPointerDown);

function destroy() {
  unsubscribe();
  detachWheel();
  control.removeEventListener("pointerdown", onPointerDown);
}
```

In Vue, call the removers in `onScopeDispose`; in Svelte, return them from `$effect`; in a web component, from `disconnectedCallback`.
