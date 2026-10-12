# @audio-ui/react

Headless, accessible primitives for audio interfaces in React: the controls and editors of a DAW or a synth, with the behavior done and the look left to you.

- **Headless.** Parts render the elements you give them, with state in `data-*` attributes and CSS variables to style from. No styles ship.
- **Accessible.** Every control holds a native input, so focus, the keyboard, screen readers and forms work as they do for a slider.
- **Composable.** Small parts that fit together (`Knob.Root`, `Knob.Control`, `Knob.Thumb`), each with a `render` prop and `className` / `style` as functions of state.
- **Built for audio.** Scales (linear, log), fine drag, a live position that moves without re-rendering React, and musical time.
- **Tree-shakeable.** Import from the root, or from a subpath such as `@audio-ui/react/knob`, and ship only what you use.

## Install

```bash
npm install @audio-ui/react
```

React 19 is required. It is built on `@audio-ui/core`, the framework-agnostic logic of the primitives, which installs with it.

## Use

```tsx
import { Knob } from "@audio-ui/react";

export function Cutoff() {
  return (
    <Knob.Root
      defaultValue={1000}
      max={20_000}
      min={20}
      onValueChange={(hz, eventDetails) => setCutoff(hz)}
      scale="log"
    >
      <Knob.Label>Cutoff</Knob.Label>
      <Knob.Control className="size-16">
        <Knob.Track />
        <Knob.Indicator />
        <Knob.Thumb aria-label="Cutoff" />
      </Knob.Control>
      <Knob.Value />
    </Knob.Root>
  );
}
```

Changes arrive as `onValueChange(value, eventDetails)`: `eventDetails.reason` says what moved it (`"drag"`, `"wheel"`, `"keyboard"`, `"reset"`), and `eventDetails.cancel()` refuses it. `onValueCommitted` fires once a gesture that changed the value ends, which is the time to start a note or save a preset.

## Primitives

| Primitive | What it is |
| --- | --- |
| `Knob`, `Fader`, `XYPad` | Rotary, linear and two-dimensional parameters |
| `Envelope`, `Plot` | Breakpoint and curve editors (ADSR, EQ, filters, compressors) |
| `Meter`, `Waveform` | Levels, peak hold, waveforms, live signals and visualizers |
| `Timeline` | The ground of an arrangement: zoom, grid, ranges, clips with trim and fades, a seekable lane |
| `Sequencer`, `Piano`, `PianoRoll` | Step grids, keyboards and a note editor |

Live values (a playhead, a meter) take a `source`, `{ getSnapshot, subscribe }`, and are written to the DOM as they move. `createSource` makes one.

## Documentation

Guides, the API of every part and live examples: <https://audio-ui.dev>. Styled components built on these primitives are copied into your project with the shadcn CLI:

```bash
npx shadcn@latest add @audio/knob
```

For AI agents there is an MCP server (`https://audio-ui.dev/mcp`) and a skill: `npx skills add ouestlabs/audio-ui`.

## License

MIT
