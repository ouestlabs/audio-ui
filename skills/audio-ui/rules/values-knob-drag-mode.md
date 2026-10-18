---
title: Set dragMode="vertical" on knobs
impact: HIGH
impactDescription: a knob that follows the hand
tags: knob, drag, pointer
---

## Set dragMode="vertical" on knobs

A knob defaults to `dragMode="circular"`: the value follows the pointer's angle around the center, which asks for a circular gesture and jumps when the press lands off to one side. On a mouse and on a phone, people drag a knob up and down, like a fader. Set `dragMode="vertical"` on every `Knob.Root` unless the dial is large and the circular gesture is the point (`"revolution"` spans a full turn per range). The wheel and the keyboard work in every mode.

**Incorrect (the default circular drag on a small knob):**

```tsx
<Knob.Root aria-label="Cutoff" defaultValue={50}>
  <Knob.Control>
    <Knob.Thumb />
  </Knob.Control>
</Knob.Root>
```

**Correct (up and down, like a fader):**

```tsx
<Knob.Root aria-label="Cutoff" defaultValue={50} dragMode="vertical">
  <Knob.Control>
    <Knob.Thumb />
  </Knob.Control>
</Knob.Root>
```
