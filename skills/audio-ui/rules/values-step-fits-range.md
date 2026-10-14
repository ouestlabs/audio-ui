---
title: Size step and largeStep to the range
impact: HIGH
impactDescription: a 0 to 1 control gets a hundred positions instead of two
tags: knob, fader, xypad, step, keyboard
---

## Size step and largeStep to the range

`step` defaults to `1` and `largeStep` (Page Up/Down, Shift + arrows) to `10`: sized for the default 0 to 100 range. On a mix, pan or 0 to 1 gain control, `step={1}` leaves only the two ends, and `largeStep={10}` sends one key press straight to the end of the range. Set both whenever the range isn't 0 to 100 (XYPad: `stepX` and `stepY`).

**Incorrect (two positions, and Page Up jumps to the end):**

```tsx
<Knob aria-label="Mix" max={1} min={0} />
<Knob anchor={0} aria-label="Pan" max={1} min={-1} step={0.01} /> // Shift + arrow jumps to a hard pan
```

**Correct (a fine step and a large step about a tenth of the range):**

```tsx
<Knob aria-label="Mix" largeStep={0.1} max={1} min={0} step={0.01} />
<Knob anchor={0} aria-label="Pan" largeStep={0.1} max={1} min={-1} step={0.01} />
<XYPad aria-label="Filter" maxX={1} maxY={1} minX={0} minY={0} stepX={0.01} stepY={0.01} />
```

With `scale="log"` the keys and the wheel move a share of the travel instead (1%, or 10% with Shift and the Page keys), so `largeStep` matters only on linear scales.
