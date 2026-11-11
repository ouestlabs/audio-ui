---
title: Create the AudioContext lazily, resume it in a gesture
impact: CRITICAL
impactDescription: sound starts at all, and SSR doesn't crash
tags: web-audio, audiocontext, autoplay, ssr
---

## Create the AudioContext lazily, resume it in a gesture

A context created at module load runs on the server in Next.js and starts `suspended` in every browser. `resume()` only works inside a user gesture.

**Incorrect:**

```tsx
const ctx = new AudioContext(); // module scope: crashes on the server

useEffect(() => {
  ctx.resume(); // not a gesture: stays suspended
}, []);
```

**Correct (the page's one context, from the registry lib):**

```bash
npx shadcn@latest add @audio-ui/web-audio
```

```tsx
"use client";

import { webAudio } from "@/lib/web-audio";

<Button
  onClick={() => {
    webAudio.resume(); // made on first use, resumed unless it runs; null on the server
    start();
  }}
>
  Play
</Button>
```

A note that starts on a press (a pad, a key) must not wait for the resume: on the first press the promise can stay pending until the pointer is released, and the voice arrives after the key is up. `webAudio.resume()` does not wait; schedule the voice at `ctx.currentTime` now, and add a one-time `pointerup` listener that resumes as well.

Use one context per page; every connected node must come from it. An engine or a lib takes it as a parameter, so it also runs on an `OfflineAudioContext`; a hook given a node uses that node's context.

On touch, `pointerdown` does not count as a user activation: a pad that starts the context on strike can stay silent for its first tap. Resume the context on `pointerup` or `click` as well (`touchend` on older iOS), and keep playing from `pointerdown` once it runs.

Track "playing" yourself: a context created inside the click can already be `running`, so a play/pause toggle that reads `ctx.state` right after `new AudioContext()` suspends it on the first click.
