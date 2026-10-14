---
title: "Headless primitives: style by state"
impact: MEDIUM
impactDescription: state styles without extra renders
tags: headless, data-attributes, css-variables
---

## Headless primitives: style by state

`@audio-ui/react` ships no CSS. Every part accepts `className` and `style` as a value **or a function of its state**, and exposes state as `data-*` attributes and CSS variables.

**Incorrect:**

```tsx
const [dragging, setDragging] = useState(false);

<Knob.Root onPointerDown={() => setDragging(true)} onPointerUp={() => setDragging(false)}>
  <Knob.Control className={dragging ? "knob dragging" : "knob"} />
</Knob.Root>
```

**Correct:**

```tsx
<Knob.Root>
  <Knob.Control className={(state) => (state.dragging ? "knob dragging" : "knob")} />
</Knob.Root>
```

```css
/* or plain CSS on the attributes */
.knob[data-dragging] { cursor: grabbing; }
.knob[data-disabled] { opacity: 0.5; }
```

Common hooks (check the part's API reference for the exact list, don't invent names):

| Hook | Examples |
| --- | --- |
| Data attributes | `data-disabled`, `data-dragging`, `data-orientation` (Fader), `data-active` (Knob.Mark, live Waveform), `data-clipping` (Meter), `data-selected`, `data-scrubbing` |
| CSS variables | `--xy-pad-x` / `--xy-pad-y`, `--knob-mark-angle`, `--waveform-position`, `--waveform-level`, `--timeline-unit`, `--sequencer-velocity`, `--piano-roll-velocity` |

Read the part list in the docs' **Anatomy** section: a part outside its parent does nothing.

```tsx
import { Knob } from "@audio-ui/react/knob"; // one entry per primitive keeps the bundle small

<Knob.Root aria-label="Cutoff" defaultValue={50}>
  <Knob.Control>
    <Knob.Track />
    <Knob.Indicator />
    <Knob.Thumb />
  </Knob.Control>
  <Knob.Value />
</Knob.Root>
```
