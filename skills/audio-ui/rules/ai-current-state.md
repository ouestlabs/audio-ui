---
title: Give the model the current state
impact: MEDIUM
impactDescription: relative edits land on the right notes and values
tags: ai, context, prompt
---

## Give the model the current state

"Remove the last two notes", "a bit brighter" and "double the tempo" are relative to what is there. Without the current state, the model guesses ids and values, or rewrites everything.

**Incorrect (the model edits blind):**

```ts
const result = await generateText({
  model,
  tools: aiTools,
  system: "You edit a piano roll.",
  prompt: userText,
});
```

**Correct (the state the tools act on is in context):**

```ts
const result = await generateText({
  model,
  tools: aiTools,
  system: [
    "You edit a piano roll. Pitches are MIDI numbers, start and length are grid steps.",
    `Range: ${minPitch} to ${maxPitch}, ${stepCount} steps.`,
    `Current state: ${JSON.stringify({ bpm: state.bpm, notes: state.notes })}`,
  ].join("\n"),
  prompt: userText,
});
```

For large states, expose a read tool (`getNotes`, `getMix`) instead of inlining everything.
