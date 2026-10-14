---
title: Keep the person in charge
impact: HIGH
impactDescription: no unattended recording, no loud playback, edits stay undoable
tags: ai, safety, consent, undo
---

## Keep the person in charge

The person and the model edit the **same** state: every change shows in the component, undo works, and any value can be overridden by hand. Some actions never belong to the model.

**Incorrect (the model can record, play and set any level):**

```ts
const tools = {
  startRecording: { schema: z.object({}), apply: () => recorder.start() },
  setVolume: { schema: z.object({ db: z.number() }), apply: (s, { db }) => ({ ...s, db }) },
};
```

**Incorrect (undo recorded inside a state updater):**

```ts
setState((prev) => {
  history.push(prev); // an updater must be pure: React runs it twice in StrictMode, so every edit is recorded twice
  return tools[name].apply(prev, args);
});
```

**Correct (consent stays with a click, levels are bounded, one undo step per call):**

```ts
const tools = {
  setVolume: {
    description: "Set the output volume in dB.",
    schema: z.object({ db: z.number().min(-60).max(0) }), // never above 0 dB
    apply: (state, { db }) => ({ ...state, db }),
  },
};
```

```tsx
// npx shadcn@latest add @audio-ui/history
import { emptyHistory, recordChange, settleChange, undo } from "@/lib/history";

const historyRef = useRef(emptyHistory<PianoRollState>());

// in applyTool, before showing `next`: what it replaces is one step
historyRef.current = recordChange(
  settleChange(historyRef.current),
  stateRef.current
);
stateRef.current = next;
setState(next);

const undoLast = () => {
  const step = undo(historyRef.current, stateRef.current);
  if (step) {
    historyRef.current = step.history;
    stateRef.current = step.present;
    setState(step.present);
  }
};
```

The history lives in a ref and is updated from the handler, never from inside a `setState` updater. The person's own edits go through the same history, so one Undo takes back either.

Starting the microphone, recording, uploading and starting playback stay behind a button the person presses.
