---
title: Size and group controls by importance
impact: HIGH
impactDescription: a panel you can scan, not a grid of identical knobs
tags: design, layout, hierarchy, signal-flow
---

## Size and group controls by importance

A grid of twelve identical knobs reads as a spreadsheet. On a real panel the controls that matter are larger, related ones sit together in a labelled section, and the sections follow the signal: input, source, filter, amplifier, output. Use at most three knob sizes (the --knob-size variable of the kit, set on the control), one section per job, and keep a destructive or master control apart from the rest. In a mixer the same holds for strips: the master is wider and set apart by a hairline, the channels are equal.

**Incorrect (twelve equal knobs in one grid):**

```tsx
<div className="grid grid-cols-6 gap-4">
  {PARAMS.map((p) => <KnobControl key={p.id} {...p} />)}
</div>
```

**Correct (sections in signal order, the master larger):**

```tsx
<div className="panel-row">
  <div className="section"><span className="legend">Filter</span>
    <KnobControl label="Cutoff" />
    <KnobControl label="Resonance" />
  </div>
  <div className="section"><span className="legend">Output</span>
    <KnobControl label="Level" style={{ "--knob-size": "6rem" }} />
  </div>
</div>
```
