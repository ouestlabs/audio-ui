---
title: Sound on change, persistence on commit
impact: HIGH
impactDescription: one write per gesture instead of hundreds
tags: events, onValueCommitted, persistence
---

## Sound on change, persistence on commit

`onValueChange` fires on every step of a drag, wheel tick and key press. `onValueCommitted` fires once when the gesture ends. Writing to storage, undo history or the network on change turns one drag into hundreds of writes.

**Incorrect:**

```tsx
<Knob
  onValueChange={(v) => {
    setCutoff(v);
    history.push({ cutoff: v });      // hundreds of undo steps per drag
    fetch("/api/preset", { method: "PATCH", body: JSON.stringify({ cutoff: v }) });
  }}
  value={cutoff}
/>
```

**Correct:**

```tsx
<Knob
  onValueChange={(v) => {
    setCutoff(v);
    filter.frequency.setTargetAtTime(v, ctx.currentTime, 0.01);
  }}
  onValueCommitted={(v) => {
    history.push({ cutoff: v });
    savePreset({ cutoff: v });
  }}
  value={cutoff}
/>
```

A drag commits once, on release. A wheel tick, a key press and a reset are each a whole interaction (`eventDetails.reason` is `"wheel"`, `"keyboard"`, `"reset"`), so spinning the wheel or holding an arrow key commits on every step. When the write is expensive (a network request), also coalesce the commits:

```tsx
const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

<Knob
  onValueCommitted={(v) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePreset({ cutoff: v }), 300); // once, after a wheel spin stops
  }}
/>
```
