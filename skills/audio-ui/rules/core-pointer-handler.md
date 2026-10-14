---
title: Prepare the pointer before pressing the controller
impact: HIGH
impactDescription: touch drags don't scroll the page, and the keys work right after a click
tags: core, pointer, touch, focus, keyboard
---

## Prepare the pointer before pressing the controller

`press(event, element)` starts the drag, but it doesn't know about the page around it. Left unprepared, a touch drag scrolls the page instead of turning the knob, the browser selects text or starts a native drag while you turn, a right-click turns the knob, and the arrow keys do nothing right after a click because focus stayed behind. The React primitives do all four; so must any other adapter.

**Incorrect (the raw event goes straight to the controller):**

```ts
control.addEventListener("pointerdown", (event) => knob.press(event, control));
```

**Correct (the primary button only, no browser gesture, focus on the hidden input):**

```ts
control.style.touchAction = "none"; // a touch drag turns the knob, it doesn't scroll the page

control.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return; // the primary button only
  }
  event.preventDefault(); // no text selection or native drag while turning
  input.focus({ preventScroll: true }); // the arrow keys work right after a click
  knob.press(event, control); // a disabled knob ignores it
});
```

`input` is the hidden `<input type="range">` of the rule `core-native-range-input`.
