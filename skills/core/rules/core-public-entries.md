---
title: Import public entries, never internal
impact: MEDIUM
impactDescription: upgrades don't break the adapter
tags: core, imports, semver
---

## Import public entries, never internal

`@audio-ui/core/internal` holds helpers for the official adapters and may change in any release. Everything an adapter needs is public: the controllers in `@audio-ui/core/<name>`, and the shared values, scales, sources and frame helpers in `@audio-ui/core`.

**Incorrect:**

```ts
import { someHelper } from "@audio-ui/core/internal";
```

**Correct:**

```ts
import { createKnobController, STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/knob";
import { createFrameTask, createSource, resolveScale } from "@audio-ui/core";
```
