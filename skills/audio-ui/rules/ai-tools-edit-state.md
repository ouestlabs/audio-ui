---
title: Tools edit state, not the DOM
impact: HIGH
impactDescription: UI, audio and undo never fall out of sync
tags: ai, tools, state
---

## Tools edit state, not the DOM

audio/ui components are controlled: their whole state is a plain value. The model produces the next value through tools; React renders it and the audio follows, exactly as when a person drags.

```
text ─▶ model ─▶ { name, args } ─▶ schema.parse ─▶ apply(state, args) ─▶ setState ─▶ component + audio
```

Each tool is `{ description, schema, apply }`: a sentence for the model, a zod schema of its arguments, and a pure reducer. One function turns a call into the next state, wherever the state lives.

**Incorrect (the model drives the interface the way a user would):**

```ts
execute: async ({ selector, value }) => {
  document.querySelector(selector)?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
};
```

**Correct (a call becomes the next state):**

```tsx
const [state, setState] = useState<PianoRollState>({ bpm: 120, notes: [] });
// The latest state, for calls that arrive before the next render: a model can
// call two tools in one step, and a state variable is stale until then.
const stateRef = useRef(state);

/** One tool call from the model. Throwing sends the message back, and the model retries. */
const applyTool = (name: string, input: unknown) => {
  // `tools["constructor"]` is truthy: only the tools you made count.
  if (!Object.hasOwn(tools, name)) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const tool = tools[name as keyof typeof tools];
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  const next = tool.apply(stateRef.current, parsed.data as never);
  stateRef.current = next;
  setState(next);
  return `${name} applied`;
};
```

The state lives in the browser, so this function does too. How a call from a server-side model reaches it is the rule `ai-structured-tool-calls`.
