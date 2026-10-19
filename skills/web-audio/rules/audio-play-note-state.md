---
title: Play the notes the way the roll shows them
impact: HIGH
impactDescription: muted notes stay silent, chance and deviation are heard
tags: web-audio, piano-roll, sequencer, notes
---

## Play the notes the way the roll shows them

The piano roll draws a note's `muted`, `chance` and `deviation`, but it plays nothing: the sequencer you write does. One that reads only `pitch`, `start`, `length` and `velocity` plays a deactivated note, plays a 25% note every time and never varies a velocity the user gave room to stray. A note can also start between steps, after a humanize or a stretch, so it starts at its own time inside the step.

**Incorrect (only the basic fields, only notes on a step):**

```tsx
onStep: (step, time) => {
  for (const note of notes) {
    if (note.start === step) {
      playNote(note.pitch, note.velocity ?? 1, time, note.length * secondsPerStep);
    }
  }
},
```

**Correct (every field the roll edits):**

```tsx
onStep: (step, time) => {
  for (const note of notes) {
    if (note.start < step || note.start >= step + 1) continue; // its step, even off the grid
    if (note.muted) continue; // deactivated: on the roll, silent
    if (Math.random() >= (note.chance ?? 1)) continue; // rolled each time round
    const velocity = Math.min(
      1,
      Math.max(0, (note.velocity ?? 1) + Math.random() * (note.deviation ?? 0))
    );
    const at = time + (note.start - step) * secondsPerStep;
    playNote(note.pitch, velocity, at, note.length * secondsPerStep);
  }
},
```

`deviation` is signed: positive strays up from the velocity, negative down. Leave muted notes out of a MIDI export too. `block-piano-roll` plays notes this way.
