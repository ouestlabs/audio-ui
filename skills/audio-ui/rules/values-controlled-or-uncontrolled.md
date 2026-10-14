---
title: Controlled or uncontrolled, never both
impact: HIGH
impactDescription: no frozen or jumping controls
tags: value, controlled, state
---

## Controlled or uncontrolled, never both

A control either owns its value (`defaultValue`) or follows yours (`value` + `onValueChange`). Passing `value` without updating it freezes the control; passing both makes it jump.

**Incorrect:**

```tsx
<Fader defaultValue={0} value={gain} />          // which one wins?
<Fader value={gain} />                           // frozen: nothing updates gain
```

**Correct:**

```tsx
<Fader defaultValue={0} />                                   // uncontrolled
<Fader onValueChange={setGain} value={gain} />               // controlled
```

`defaultValue` is still useful on a controlled Knob: it is the double-tap reset target.
