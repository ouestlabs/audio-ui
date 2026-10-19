---
title: Show state with the parts' attributes, not only on hover
impact: HIGH
impactDescription: controls that answer touch, keyboard and sound
tags: design, states, data-attributes, feedback
---

## Show state with the parts' attributes, not only on hover

A control must answer the hand: a grabbed knob, a struck pad, a clipping meter. The parts expose it as `data-dragging`, `data-active`, `data-clipping`, `data-warning` and `data-disabled`, plus `--pad-velocity` on a pad. Draw those, and a visible `:focus-visible` ring. Hover does not exist on touch, and motion alone is not feedback: pair it with a color or a position change. Keep transitions under 120ms on a hit, and animate only the properties that change.

**Incorrect (hover only, a transition on everything):**

```css
.pad { transition: all 0.4s ease; }
.pad:hover { background: orange; }
```

**Correct (the struck state, scaled by velocity, with a short transition):**

```css
.pad { transition: background 60ms linear, transform 60ms linear; }
.pad[data-active] {
  transform: translateY(2px);
  background: color-mix(in oklab, var(--accent) calc(40% + var(--pad-velocity, 0.6) * 60%), var(--surface));
}
.pad:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```
