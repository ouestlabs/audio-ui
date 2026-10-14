---
title: Schemas come from the instance
impact: HIGH
impactDescription: rejects hallucinated instruments and out-of-range steps
tags: ai, zod, schema
---

## Schemas come from the instance

Bounds, enums and lengths come from the config of the component on screen. A hard-coded schema lets the model name instruments that don't exist or steps past the grid.

**Incorrect:**

```ts
const schema = z.object({
  instrument: z.enum(["kick", "snare", "hat"]), // this kit has a clap and no hat
  step: z.number(),                            // unbounded
});
```

**Correct:**

```ts
function createDrumTools({ instruments, stepCount }: { instruments: [string, ...string[]]; stepCount: number }) {
  const toggleStep = z.object({
    instrument: z.enum(instruments),
    step: z.number().int().min(0).max(stepCount - 1),
  });
  // ...
}
```

Build the tool set with a factory that takes the config. For a piano roll it is installable:

```bash
npx shadcn@latest add @audio-ui/piano-roll-tools   # needs zod
```

```ts
const tools = createPianoRollTools({ minPitch: 36, maxPitch: 72, stepCount: 32 });
// setNotes, addNotes, removeNotes, transpose, clear, setTempo
// state: { bpm, notes: { id, pitch, start, length, velocity }[] }, start/length in grid steps
```
