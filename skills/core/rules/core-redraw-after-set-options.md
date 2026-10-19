---
title: Pass every option to setOptions, then redraw
impact: HIGH
impactDescription: a disabled, rescaled or re-ranged control shows it at once
tags: core, controller, setOptions
---

## Pass every option to setOptions, then redraw

`setOptions` **replaces** the options (it doesn't merge) and **notifies no one**: subscribers only hear about value and gesture changes. React gets away with it because it re-renders anyway; any other adapter must keep the full options and redraw after setting them.

Create the controller empty and call `setOptions` before the first draw, as the React primitives do. Every option then applies from the start, on any release.

**Incorrect (a partial object, no redraw):**

```ts
knob.setOptions({ disabled: true }); // max, min, step, callbacks... are gone
// and the view still shows an enabled knob
```

**Correct (merge, set, redraw):**

```ts
let current: KnobOptions = { max: 100, min: 0, onValueChange };

function update(next: Partial<KnobOptions>) {
  current = { ...current, ...next };
  knob.setOptions(current);
  render(); // draws from knob.getSnapshot()
}
```
