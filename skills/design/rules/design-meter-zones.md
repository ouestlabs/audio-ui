---
title: Draw meter zones on the channel
impact: HIGH
impactDescription: green, amber and red stay where the levels are
tags: design, meter, gradient, zones
---

## Draw meter zones on the channel

`Meter.Indicator` is a full-height bar scaled to the level. A gradient painted on it is squeezed with it, so the red zone slides down the bar as the level falls and shows at a third of the range. Paint the zones on the channel, dimmed, and let the indicator light them back up where it reaches (`mix-blend-mode: color-dodge`). A mask on the channel cuts the bar into lamps, and it must be on the channel too, since a mask on the indicator would squeeze as well. A flat direction (minimal, modern) needs no zones: one bar color, and a second only on `data-clipping`.

**Incorrect (the gradient shrinks with the bar):**

```css
.meter-indicator {
  background: linear-gradient(0deg, green 0 60%, orange 60% 85%, red 85%);
  background-size: 100% 9.5rem;
}
```

**Correct (zones on the channel, the indicator lights them):**

```css
.meter-channel {
  isolation: isolate;
  background: linear-gradient(rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.72)),
    linear-gradient(0deg, green 0 60%, orange 60% 85%, red 85%);
  mask: repeating-linear-gradient(0deg, #000 0 4px, transparent 4px 6px);
}
.meter-indicator {
  background: rgb(184 184 184);
  mix-blend-mode: color-dodge;
}
```
