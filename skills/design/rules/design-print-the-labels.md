---
title: Print labels and scales on the panel
impact: HIGH
impactDescription: a panel that reads as an instrument, and is legible
tags: design, typography, labels, scale
---

## Print labels and scales on the panel

On real hardware every control is named and graduated by ink printed on the panel, not by a tooltip. Use small uppercase labels with wide tracking in one ink color, tabular numbers for values, ticks at the marks (`Knob.Mark` with a `.knob-tick`) and a section title that sits on a line around a group. Keep contrast legible: dim ink is for secondary text, never for the value you are reading.

**Incorrect (a mixed-case label in a default font, no scale):**

```css
.knob-label { font-size: 14px; font-weight: 400; }
```

**Correct (silkscreen type, tabular value, printed marks):**

```css
.knob-label {
  font: 700 0.6rem/1 "Arial Narrow", Arial, sans-serif;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.knob-value { font-variant-numeric: tabular-nums; }
.knob-tick { background: currentColor; height: 5px; }
```
