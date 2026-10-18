---
title: Announce a live readout on change, not every frame
impact: HIGH
impactDescription: a screen reader that is usable, not flooded
tags: accessibility, live-region, readout, tuner
---

## Announce a live readout on change, not every frame

A display that updates every frame (a tuner's cents, a loudness number, a position) is not a control, so the primitives' slider semantics do not cover it. Putting `aria-live` on it makes a screen reader read every frame. Give the visual display `aria-hidden="true"`, or `role="meter"` with `aria-valuenow` and `aria-valuetext`, and put the spoken version in a separate polite status that changes only when the meaning does: a new note, in tune or not, a level class.

**Incorrect (announced every frame):**

```tsx
<output aria-live="polite">{note.name} {note.cents.toFixed(1)} cents</output>
```

**Correct (the display is silent, a status speaks on a change):**

```tsx
<div aria-hidden="true">{note.name} {note.cents.toFixed(1)}</div>
<p className="sr-only" role="status">
  {inTune ? `${note.name}, in tune` : `${note.name}, ${note.cents > 0 ? "sharp" : "flat"}`}
</p>
```
