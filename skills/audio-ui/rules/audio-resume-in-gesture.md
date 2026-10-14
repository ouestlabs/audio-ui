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

**Correct:**

```tsx
"use client";

let ctx: AudioContext | null = null;
export const getContext = () => (ctx ??= new AudioContext());

<Button
  onClick={async () => {
    await getContext().resume();
    start();
  }}
>
  Play
</Button>
```

The registry ships this as a lib: `npx shadcn@latest add @audio-ui/web`. Use one context per page; every connected node must come from it.
