---
title: Signals go through a source, not state
impact: CRITICAL
impactDescription: no React render per frame
tags: source, createSource, re-render, meter
---

## Signals go through a source, not state

A level, a playhead or a spectrum changes 60 times a second. Through `setState`, that is 60 React renders a second of everything under the state owner. Meter, Plot traces and dots, Waveform and Timeline take a **`source`** instead and write each frame straight to the DOM.

A source is any `{ getSnapshot, subscribe }` object. `createSource` from `@audio-ui/react` makes one you push to with `set`.

**Incorrect:**

```tsx
const [levels, setLevels] = useState([-100, -100]);

useEffect(() => {
  const tick = () => {
    setLevels(readLevels()); // re-renders the whole mixer every frame
    frame = requestAnimationFrame(tick);
  };
  let frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, []);

<Meter aria-label="Master" value={levels} />
```

**Correct:**

```tsx
import { createSource, type Meter as MeterPrimitive } from "@audio-ui/react";
import { Meter } from "@/components/audio-ui/meter";

const [levels] = useState(() =>
  createSource<MeterPrimitive.Root.Frame>({ levels: [] })
);

useEffect(() => {
  const tick = () => {
    levels.set({ levels: readLevels() });
    frame = requestAnimationFrame(tick);
  };
  let frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, [levels]);

<Meter aria-label="Master" source={levels} />
```

`value` is right for levels that change rarely (a static mock, a settings preview).
