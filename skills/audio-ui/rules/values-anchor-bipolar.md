---
title: Anchors for bipolar controls
impact: LOW
impactDescription: the center reads as the center
tags: knob, anchor, pan
---

## Anchors for bipolar controls

A pan or detune control is centered. Without an anchor, the indicator arc grows from the minimum, so "center" looks like "half way".

**Incorrect:**

```tsx
<Knob aria-label="Pan" defaultValue={0} max={1} min={-1} step={0.01} />
```

**Correct:**

```tsx
<Knob anchor={0} aria-label="Pan" defaultValue={0} largeStep={0.1} max={1} min={-1} step={0.01} />
```
