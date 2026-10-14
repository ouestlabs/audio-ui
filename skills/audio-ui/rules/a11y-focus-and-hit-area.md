---
title: Focus and hit areas
impact: MEDIUM
impactDescription: visible focus, and thumbs you can grab on touch
tags: accessibility, focus-visible, touch
---

## Focus and hit areas

The headless primitives draw nothing, focus ring included. A thumb sized for the design (often 10 to 14px) is too small to grab with a finger.

**Incorrect (focus removed, hit area as small as the drawing):**

```css
.thumb {
  width: 12px;
  height: 12px;
  outline: none;
}
```

**Correct (a visible focus ring, a larger invisible hit area):**

```css
.thumb {
  position: relative;
  width: 12px;
  height: 12px;
}

.thumb:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* widen what the pointer can grab, not what is drawn */
.thumb::before {
  content: "";
  position: absolute;
  inset: -8px;
}
```
