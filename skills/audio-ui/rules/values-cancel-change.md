---
title: Rejecting a change
impact: MEDIUM
impactDescription: the control and its announced value stay in sync
tags: events, cancel
---

## Rejecting a change

To refuse a value (a locked track, a value an app rule forbids), cancel the change. Ignoring it in state leaves the control and the announced value out of sync for a frame.

**Incorrect:**

```tsx
<Fader onValueChange={(v) => { if (!locked) setGain(v); }} value={gain} />
```

**Correct:**

```tsx
<Fader
  onValueChange={(v, eventDetails) => {
    if (locked) {
      eventDetails.cancel();
      return;
    }
    setGain(v);
  }}
  value={gain}
/>
```

`eventDetails.reason` says what caused the change (`"drag"`, `"keyboard"`, `"wheel"`, `"reset"`, `"input-change"`), and on a piano roll `eventDetails.edit` says what was edited.
