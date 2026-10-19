---
title: One light source, a few materials
impact: HIGH
impactDescription: depth that reads as real instead of as decoration
tags: design, skeuomorphism, shadows, materials
---

## One light source, a few materials

A skeuomorphic panel is believable when every highlight and shadow agrees on one light, usually above and to the left. Highlights sit on the top edge, shadows fall down, an inset control is lit from the bottom. Limit the panel to four or five materials (enamel, metal, plastic, rubber, glass), each with its own highlight: metal has sharp streaks, plastic one broad soft spot, rubber almost none, glass a small bright reflection.

**Incorrect (shadows in every direction, glow on everything):**

```css
.knob-thumb {
  background: radial-gradient(circle at 70% 70%, #fff, #888);
  box-shadow: 0 0 20px #0ff, -6px -6px 12px #fff, 6px 6px 12px #000;
}
```

**Correct (light from the top left, a short hard shadow, glow only on lamps):**

```css
.knob-thumb {
  background: radial-gradient(circle at 32% 26%, #f4f1ea, #9c978c 55%, #55524b);
  box-shadow:
    0 6px 8px rgb(0 0 0 / 0.55),
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    inset 0 -2px 3px rgb(0 0 0 / 0.35);
}
```
