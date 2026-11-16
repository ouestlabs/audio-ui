---
title: "Headless primitives: style by state"
impact: MEDIUM
impactDescription: state styles without extra renders
tags: headless, data-attributes, css-variables
---

## Headless primitives: style by state

The headless primitives ship no CSS. Every part takes the classes and attributes of its element, and exposes its state as `data-*` attributes and CSS variables to style from.

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
  <Knob.Control className="knob data-[dragging]:cursor-grabbing" />
</Knob.Root>
```

```css
/* or plain CSS on the attributes */
.knob[data-dragging] { cursor: grabbing; }
.knob[data-disabled] { opacity: 0.5; }
```

Common hooks (check the primitive's page for the exact list, don't invent names):

| Hook | Examples |
| --- | --- |
| Data attributes | `data-disabled`, `data-dragging`, `data-orientation` (Fader), `data-active` (Knob.Mark, live Waveform), `data-clipping` (Meter), `data-selected`, `data-scrubbing`, `data-in-scale`, `data-out-of-scale`, `data-scale-root` (PianoRoll.Row), `data-muted` (PianoRoll.Note), `data-has-selection` (PianoRoll.Root) |
| CSS variables | `--xy-pad-x` / `--xy-pad-y`, `--knob-mark-angle`, `--waveform-position`, `--waveform-level`, `--timeline-unit`, `--sequencer-velocity`, `--piano-roll-velocity`, `--piano-roll-chance`, `--piano-roll-level`, `--piano-roll-deviation` |

Read the part list on the primitive's page (`https://www.audio-ui.dev/docs/components/base/<name>`, under Usage): a part outside its parent does nothing.

```tsx
import { Knob } from "@/components/audio-ui/knob/react"; // installed with `npx shadcn@latest add @audio-ui/knob-react`

<Knob.Root aria-label="Cutoff" defaultValue={50}>
  <Knob.Control>
    <Knob.Track />
    <Knob.Indicator />
    <Knob.Thumb />
  </Knob.Control>
  <Knob.Value />
</Knob.Root>
```
