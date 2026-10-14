---
title: Keep a native range input for keyboard and screen readers
impact: HIGH
impactDescription: the control is focusable, named, announced and submitted with forms
tags: core, accessibility, keyboard, input
---

## Keep a native range input for keyboard and screen readers

The controllers handle keys, but something has to take focus, carry the name and announce the value. The React primitives use a visually hidden `<input type="range">` inside the thumb: do the same. Route its keys to `keyDown` (and prevent the default when it returns `true`), and its `input` event to `type`, which is how assistive technology sets a value.

**Incorrect (a focusable div that handles keys itself):**

```html
<div class="knob" tabindex="0" onkeydown="value++"></div>
```

**Correct (a real range input wired to the controller):**

```html
<div class="knob-thumb">
  <input type="range" aria-label="Cutoff" class="visually-hidden" />
</div>
```

```ts
input.addEventListener("keydown", (event) => {
  if (knob.keyDown(event)) {
    event.preventDefault(); // arrows, Page Up/Down, Home, End, Delete to reset
  }
});
input.addEventListener("input", (event) => knob.type(Number(input.value), event));

// in render(): keep the input in step with the snapshot
input.value = String(s.value);
input.setAttribute("aria-valuetext", s.formatted);
input.disabled = s.disabled;
```

Hide it with a visually-hidden style, not `display: none`, or it can't take focus.
