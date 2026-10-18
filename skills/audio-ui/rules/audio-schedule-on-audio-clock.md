---
title: Schedule on the audio clock
impact: CRITICAL
impactDescription: sample-accurate timing that survives background tabs
tags: web-audio, scheduling, sequencer, transport
---

## Schedule on the audio clock

`setInterval` and `setTimeout` drift, and browsers throttle them in background tabs. A sequencer that plays a note when its own timer fires swings and stalls.

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

The clock looks ahead and hands you the exact `AudioContext` time of each step. Start every node at that `time`. `clock.getPosition()` gives the playhead in steps for the UI; `@audio-ui/musical-time` converts tempo to seconds. `start()` does not resume a suspended context: call `ctx.resume()` in the same click first (rule `audio-resume-in-gesture`).

Without the registry, the same clock is a timer that only looks ahead: every 25 ms it schedules the steps that fall in the next 120 ms at their exact audio time. The timer decides when to look, the audio clock decides when a note sounds:

```ts
let next = ctx.currentTime;
let step = 0;
const timer = setInterval(() => {
  while (next < ctx.currentTime + 0.12) {
    for (const row of pattern) {
      if (row[step]) playAt(next); // osc.start(next)
    }
    next += 60 / bpm / 4;
    step = (step + 1) % 16;
  }
}, 25);
```

Read `bpm` from a ref so a tempo change applies on the next step, publish `step` through a source (`-1` on stop), and `clearInterval(timer)` on cleanup.
