---
title: dB on the control, linear gain on the node
impact: HIGH
impactDescription: correct and safe output levels
tags: web-audio, gain, decibels
---

## dB on the control, linear gain on the node

People think in dB; `GainNode.gain` is a linear multiplier.

**Incorrect:**

```ts
gain.gain.setTargetAtTime(db, ctx.currentTime, 0.01); // -6 becomes a gain of -6: inverted and loud
```

**Correct:**

```ts
const SILENCE_DB = -60;
const toGain = (db: number) => (db <= SILENCE_DB ? 0 : 10 ** (db / 20));

gain.gain.setTargetAtTime(toGain(db), ctx.currentTime, 0.01);
```
