---
title: Draw from the snapshot
impact: HIGH
impactDescription: the view matches the scale, sweep and formatting exactly
tags: core, snapshot, subscribe, geometry
---

## Draw from the snapshot

The controller already computed what to draw: `angle`, `percent`, `anchorPercent`, `formatted`, `dragging`, `disabled`. Recomputing geometry from `value` gets the sweep wrong (the knob turns 288°, not 270°), ignores `scale="log"`, and shows the value instead of the dragged one. Subscribe, read the snapshot, draw it.

**Incorrect (geometry recomputed from the value):**

```ts
const angle = ((value - min) / (max - min)) * 270 - 135; // wrong sweep, linear only
thumb.style.rotate = `${angle}deg`;
label.textContent = String(value);
```

**Correct (everything from the snapshot):**

```ts
const render = () => {
  const s = knob.getSnapshot();
  thumb.style.rotate = `${s.angle}deg`;
  label.textContent = s.formatted;
  root.toggleAttribute("data-dragging", s.dragging);
};
const unsubscribe = knob.subscribe(render);
render();
```

`getSnapshot` returns the same object until something changes, so it can back a framework store directly ([core.md](../core.md)).
