---
title: "Registry components: props before className"
impact: MEDIUM
impactDescription: keeps proportions and theme
tags: registry, variants, className
---

## Registry components: props before className

The copied components (`@/components/audio-ui/*`) carry size variants and options. Overriding their internals with classes breaks proportions and the theme.

**Incorrect:**

```tsx
<Knob className="h-24 w-24 [&_svg]:stroke-[6]" />
<Fader className="[&_[data-slot=thumb]]:hidden" />
```

**Correct:**

```tsx
import { Fader } from "@/components/audio-ui/fader";
import { Knob } from "@/components/audio-ui/knob";

<Knob size="lg" />
<Fader marks={[0, -6, -12, -24]} orientation="horizontal" valueLabel="always" />
```

`className` is for layout around the component (grid placement, margins). If a look needs a change the props don't offer, edit the copied file: it belongs to the project.
