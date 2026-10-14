---
title: Playheads and playback position
impact: HIGH
impactDescription: a smooth playhead instead of 4 jumps a second
tags: waveform, timeline, playhead, source
---

## Playheads and playback position

A seekable Waveform and every Timeline playhead follow a `source` of the position, in the same unit as their `duration`.

**Incorrect:**

```tsx
const [time, setTime] = useState(0);
<audio onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} /> // ~4 updates/s: the playhead stutters
```

**Correct:**

```tsx
const [position] = useState(() => createSource(0));

useEffect(() => {
  let frame = 0;
  const tick = () => {
    position.set(audio.currentTime); // or clock.getPosition() for a sequencer
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, [audio, position]);
```

Commit seeks (the user dropping the playhead) through `onValueCommitted`, then set `audio.currentTime`.
