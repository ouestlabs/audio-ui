# audio/ui core

**Version 1.2.0**  
audio/ui  
October 2026

> **Note:**  
> This document is for agents and LLMs building audio interfaces with audio/ui. It is generated from `rules/` by `bun run skill:build` in `apps/www`: edit the rules, not this file.

---

## Abstract

How to build audio controls without React on @audio-ui/core, for AI agents and LLMs: one controller per control, a native range input, drawing from snapshots and clean teardown, in Vue, Svelte, Solid, Angular, web components or the plain DOM. Each rule shows the incorrect code an agent tends to write and the correct code with the real audio/ui API.

---

## Table of Contents

1. [Without React](#1-without-react): **HIGH**
   - 1.1 [Draw from the snapshot](#11-draw-from-the-snapshot)
   - 1.2 [Keep a native range input for keyboard and screen readers](#12-keep-a-native-range-input-for-keyboard-and-screen-readers)
   - 1.3 [One controller per control, created once](#13-one-controller-per-control-created-once)
   - 1.4 [Pass every option to setOptions, then redraw](#14-pass-every-option-to-setoptions-then-redraw)
   - 1.5 [Prepare the pointer before pressing the controller](#15-prepare-the-pointer-before-pressing-the-controller)
   - 1.6 [Import public entries, never internal](#16-import-public-entries-never-internal)
   - 1.7 [Tear down what you attach](#17-tear-down-what-you-attach)

---

## 1. Without React

**Impact: HIGH**

Vue, Svelte, Solid, Angular, web components or the plain DOM: the same controls built on the framework-free controllers of `@audio-ui/core`.

### 1.1 Draw from the snapshot

**Impact: HIGH (the view matches the scale, sweep and formatting exactly)**

The controller already computed what to draw: `angle`, `percent`, `anchorPercent`, `formatted`, `dragging`, `disabled`. Recomputing geometry from `value` gets the sweep wrong (the knob turns 288°, not 270°), ignores `scale="log"`, and shows the value instead of the dragged one. Subscribe, read the snapshot, draw it.

**Incorrect (geometry recomputed from the value):**

```ts
const angle = ((value - min) / (max - min)) * 270 - 135; // wrong sweep, linear only
thumb.style.rotate = `${angle}deg`;
label.textContent = String(value);
```

**Correct (everything from the snapshot):**

```ts
const render = () => {
  const s = knob.getSnapshot();
  thumb.style.rotate = `${s.angle}deg`;
  label.textContent = s.formatted;
  root.toggleAttribute("data-dragging", s.dragging);
};
const unsubscribe = knob.subscribe(render);
render();
```

`getSnapshot` returns the same object until something changes, so it can back a framework store directly ([core.md](./core.md)).

### 1.2 Keep a native range input for keyboard and screen readers

**Impact: HIGH (the control is focusable, named, announced and submitted with forms)**

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

### 1.3 One controller per control, created once

**Impact: HIGH (drags, focus and the uncontrolled value survive option changes)**

A controller holds the gesture in flight and, when uncontrolled, the value. Recreating it whenever an option changes (a reactive block, a computed, a re-render) drops the drag under the pointer and resets the value. Create it once per mounted control and hand it new options with `setOptions`.

**Incorrect (a new controller on every change):**

```ts
// Vue
const knob = computed(() => createKnobController({ max: props.max, min: props.min }));
```

**Correct (created once, options updated):**

```ts
// Vue
const knob = createKnobController();
watchEffect(() => {
  knob.setOptions(options());
  sync();
});
```

Every primitive follows the same shape: `create<Name>Controller` from `@audio-ui/core/<name>` (`createKnobController`, `createFaderController`, `createXYPadController`, `createSequencerController`…).

### 1.4 Pass every option to setOptions, then redraw

**Impact: HIGH (a disabled, rescaled or re-ranged control shows it at once)**

`setOptions` **replaces** the options (it doesn't merge) and **notifies no one**: subscribers only hear about value and gesture changes. React gets away with it because it re-renders anyway; any other adapter must keep the full options and redraw after setting them.

Create the controller empty and call `setOptions` before the first draw, as the React primitives do. Every option then applies from the start, on any release.

**Incorrect (a partial object, no redraw):**

```ts
knob.setOptions({ disabled: true }); // max, min, step, callbacks... are gone
// and the view still shows an enabled knob
```

**Correct (merge, set, redraw):**

```ts
let current: KnobOptions = { max: 100, min: 0, onValueChange };

function update(next: Partial<KnobOptions>) {
  current = { ...current, ...next };
  knob.setOptions(current);
  render(); // draws from knob.getSnapshot()
}
```

### 1.5 Prepare the pointer before pressing the controller

**Impact: HIGH (touch drags don't scroll the page, and the keys work right after a click)**

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

### 1.6 Import public entries, never internal

**Impact: MEDIUM (upgrades don't break the adapter)**

`@audio-ui/core/internal` holds helpers for the official adapters and may change in any release. Everything an adapter needs is public: the controllers in `@audio-ui/core/<name>`, and the shared values, scales, sources and frame helpers in `@audio-ui/core`.

**Incorrect:**

```ts
import { someHelper } from "@audio-ui/core/internal";
```

**Correct:**

```ts
import { createKnobController, STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/knob";
import { createFrameTask, createSource, resolveScale } from "@audio-ui/core";
```

### 1.7 Tear down what you attach

**Impact: MEDIUM (no listeners or redraws on unmounted controls)**

`subscribe` and `attachWheel` return their own removers. A control unmounted without them keeps redrawing a detached node and swallowing wheel events.

**Incorrect:**

```ts
knob.subscribe(render);
knob.attachWheel(control);
control.addEventListener("pointerdown", onPointerDown);
```

**Correct:**

```ts
const unsubscribe = knob.subscribe(render);
const detachWheel = knob.attachWheel(control);
control.addEventListener("pointerdown", onPointerDown);

function destroy() {
  unsubscribe();
  detachWheel();
  control.removeEventListener("pointerdown", onPointerDown);
}
```

In Vue, call the removers in `onScopeDispose`; in Svelte, return them from `$effect`; in a web component, from `disconnectedCallback`.

---

## References

1. https://www.audio-ui.dev/docs
2. https://www.audio-ui.dev/llms.txt
3. https://www.w3.org/WAI/ARIA/apg/patterns/slider/
