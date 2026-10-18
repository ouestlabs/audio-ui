---
title: Make the readout editable
impact: HIGH
impactDescription: exact values by keyboard, with no extra UI
tags: knob, fader, value, editable
---

## Make the readout editable

A knob or fader is imprecise by hand: nobody lands on exactly 440 Hz or -6.0 dB with a drag. `Knob.Value` and `Fader.Value` take `editable`: a double-click, or Enter while the readout has focus, turns it into a field where a number is typed. Enter commits it (a unit or a decimal comma is fine, and it is clamped to the range), Escape drops it. It costs one prop and no extra control, and it is also the keyboard way to type a value. Style the field with a plain `input` inside the readout.

**Incorrect (a readout that can only be read):**

```tsx
<Knob.Root aria-label="Cutoff" defaultValue={1000} max={20000} min={20} scale="log">
  <Knob.Control>
    <Knob.Thumb />
  </Knob.Control>
  <Knob.Value />
</Knob.Root>
```

**Correct (type an exact value):**

```tsx
<Knob.Root aria-label="Cutoff" defaultValue={1000} max={20000} min={20} scale="log">
  <Knob.Control>
    <Knob.Thumb />
  </Knob.Control>
  <Knob.Value editable />
</Knob.Root>
```
