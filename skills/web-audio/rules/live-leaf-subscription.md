---
title: Showing a live value as text
impact: MEDIUM
impactDescription: only the readout re-renders, not the mixer around it
tags: source, useSyncExternalStore, re-render
---

## Showing a live value as text

A number readout of a live level has to re-render to change. Subscribe to the source in the smallest component that shows it, never in a parent that also renders the controls.

**Incorrect (the whole channel strip re-renders every frame):**

```tsx
function ChannelStrip({ levels }: { levels: Levels }) {
  const frame = useSyncExternalStore(levels.subscribe, levels.getSnapshot);
  return (
    <div>
      <Fader aria-label="Volume" />
      <Knob anchor={0} aria-label="Pan" largeStep={0.1} max={1} min={-1} step={0.01} />
      <Meter aria-label="Level" source={levels} />
      <span>{Math.round(frame.peaks?.[0] ?? -100)} dB</span>
    </div>
  );
}
```

**Correct (a leaf owns the subscription):**

```tsx
import type { Meter as MeterPrimitive, Source } from "@audio-ui/react";
import { useSyncExternalStore } from "react";
import { Fader } from "@/components/audio-ui/fader";
import { Knob } from "@/components/audio-ui/knob";
import { Meter } from "@/components/audio-ui/meter";

type Levels = Source<MeterPrimitive.Root.Frame>;

function PeakReadout({ levels }: { levels: Levels }) {
  const frame = useSyncExternalStore(levels.subscribe, levels.getSnapshot);
  return <span className="tabular-nums">{Math.round(frame.peaks?.[0] ?? -100)} dB</span>;
}

function ChannelStrip({ levels }: { levels: Levels }) {
  return (
    <div>
      <Fader aria-label="Volume" />
      <Knob anchor={0} aria-label="Pan" largeStep={0.1} max={1} min={-1} step={0.01} />
      <Meter aria-label="Level" source={levels} />
      <PeakReadout levels={levels} />
    </div>
  );
}
```
