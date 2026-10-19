---
title: Ramp parameters, never assign them
impact: CRITICAL
impactDescription: removes clicks and zipper noise while dragging
tags: web-audio, audioparam, smoothing
---

## Ramp parameters, never assign them

Setting `.value` jumps the parameter instantly. At audio rate that jump is a click, and a drag is a burst of clicks ("zipper noise").

**Incorrect:**

```ts
onValueChange={(v) => { gain.gain.value = v; }}
```

**Correct:**

```ts
onValueChange={(v) => {
  gain.gain.setTargetAtTime(v, ctx.currentTime, 0.01); // ~10 ms glide
}}
```
