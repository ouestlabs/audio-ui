---
title: Accessible names
impact: HIGH
impactDescription: controls usable with a screen reader
tags: accessibility, aria-label
---

## Accessible names

The primitives set the role, `aria-valuenow` and `aria-valuetext`. Only you know what the control is for.

**Incorrect:**

```tsx
<div className="flex gap-4">
  <Knob />
  <Knob />
</div>
```

**Correct:**

```tsx
<div className="flex gap-4">
  <Knob aria-label="Cutoff" />
  <Knob aria-label="Resonance" />
</div>
```

With several channels, a Meter names each one from its `aria-label` ("Master 1", "Master 2").

The value text is announced too. `format` takes `Intl.NumberFormat` options such as `{ maximumFractionDigits: 1 }` or `{ style: "percent" }`, but `Intl` has no hertz or decibel unit, and an unknown unit throws while the control renders. Put the unit in `formatValue` on the registry Knob and Fader (it prints the readout and the announced text), or in `getAriaValueText` on the primitive's thumb:

```tsx
<Knob
  aria-label="Cutoff"
  formatValue={(hz) => `${Math.round(hz)} Hz`}
  max={20_000}
  min={20}
  scale="log"
/>

<Knob.Thumb getAriaValueText={(formatted) => `${formatted} Hz`} />
```
