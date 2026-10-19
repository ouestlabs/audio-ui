---
title: Clean up what you create
impact: MEDIUM
impactDescription: no orphan oscillators or loops after unmount
tags: web-audio, effects, cleanup
---

## Clean up what you create

Nodes and loops outlive an unmounted component: oscillators keep running, analysers keep sampling.

**Incorrect:**

```tsx
useEffect(() => {
  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.start();
}, [ctx]);
```

**Correct:**

```tsx
useEffect(() => {
  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.start();
  return () => {
    osc.stop();
    osc.disconnect();
  };
}, [ctx]);
```

Don't `close()` a context other components share.
