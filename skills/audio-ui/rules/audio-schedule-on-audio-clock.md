---
title: Schedule on the audio clock
impact: CRITICAL
impactDescription: sample-accurate timing that survives background tabs
tags: web-audio, scheduling, sequencer, transport
---

## Schedule on the audio clock

`setInterval` and `setTimeout` drift, and browsers throttle them in background tabs. A sequencer driven by them swings and stalls.

**Incorrect:**

```ts
setInterval(() => {
  step = (step + 1) % 16;
  if (pattern[row][step]) playKick(); // starts "now", whenever now happens to be
}, (60 / bpm / 4) * 1000);
```

**Correct:**

```tsx
// npx shadcn@latest add @audio-ui/use-transport-clock
const clock = useTransportClock({
  bpm,
  totalSteps: 16,
  onStep: (step, time) => {
    if (pattern[row][step]) playKick(time); // osc.start(time), envelope at time
  },
  onReset: () => releaseAll(), // seek/stop: silence what was scheduled ahead
});
```

The clock looks ahead and hands you the exact `AudioContext` time of each step. Start every node at that `time`. `clock.getPosition()` gives the playhead in steps for the UI; `@audio-ui/musical-time` converts tempo to seconds.
