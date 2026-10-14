---
title: apply is pure and re-clamps
impact: MEDIUM
impactDescription: every tool call yields a valid state
tags: ai, reducer, clamp
---

## apply is pure and re-clamps

A schema catches wrong types; it can't catch every odd combination (a note that starts in range and ends past the grid). Clamp and snap again in `apply`, the way the component would.

**Incorrect:**

```ts
apply: (state, { notes }) => ({ ...state, notes: [...state.notes, ...notes] }),
```

**Correct:**

```ts
apply: (state, { notes }) => ({
  ...state,
  notes: [...state.notes, ...notes.map((n, i) => clampNoteToDomain(n, nextId(state) + i, domain))],
}),
```

Pure reducers are testable without a model: test them like any function.
