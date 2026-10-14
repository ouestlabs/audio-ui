---
title: Logarithmic scales for frequency
impact: MEDIUM
impactDescription: usable travel across the audible range
tags: knob, scale, frequency
---

## Logarithmic scales for frequency

Hearing is logarithmic. On a linear 20 Hz to 20 kHz knob, the whole musical range sits in the first few degrees.

**Incorrect:**

```tsx
<Knob aria-label="Cutoff" max={20_000} min={20} />
```

**Correct:**

```tsx
<Knob aria-label="Cutoff" max={20_000} min={20} scale="log" />
```

`scale="log"` needs a positive `min`. Use it for frequency, Q and ratios. Level in dB is already logarithmic: keep it linear in dB.
