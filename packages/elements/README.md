# @audio-ui/elements

Unstyled, accessible Web Components for every primitive, built on `@audio-ui/core` and at API parity with `@audio-ui/react`. They run in plain HTML and in any framework that renders HTML.

- **Unstyled.** The elements apply only the styles their behavior depends on, in zero-specificity rules. State is exposed as `data-*` attributes, the same as the React parts.
- **Accessible.** Every value is set through a native `<input type="range">` or an ARIA role, with full keyboard support, so focus, assistive technology and forms behave as they do for native controls.
- **Composable.** Each primitive is a root element with compound parts, mirroring the anatomy of `@audio-ui/react`.
- **Framework-agnostic.** No runtime dependency beyond `@audio-ui/core`. Values are attributes and properties; changes are DOM events.

## Installation

```bash
npm install @audio-ui/elements
```

`@audio-ui/core` is installed as a dependency.

## Usage

Each primitive is a separate entry point, `@audio-ui/elements/<primitive>`, which registers its elements when imported. The package root registers every primitive.

```js
import "@audio-ui/elements/knob";
```

```html
<audio-ui-knob min="20" max="20000" default-value="1000" scale="log">
  <audio-ui-knob-label>Cutoff</audio-ui-knob-label>
  <audio-ui-knob-control>
    <audio-ui-knob-track></audio-ui-knob-track>
    <audio-ui-knob-indicator></audio-ui-knob-indicator>
    <audio-ui-knob-thumb></audio-ui-knob-thumb>
  </audio-ui-knob-control>
  <audio-ui-knob-value></audio-ui-knob-value>
</audio-ui-knob>
```

```js
const knob = document.querySelector("audio-ui-knob");
knob.addEventListener("input", (event) => setCutoff(event.detail.value));
knob.addEventListener("change", () => savePreset());
```

`input` fires on every change, with `event.detail.value` and `event.detail.reason`; `preventDefault()` rejects the change. `change` fires once when an interaction that changed the value ends. The `value` property reads and sets the value. Parts with a value of their own fire prefixed events, such as `clipinput` and `clipchange`.

## Elements

| Element | Description |
| --- | --- |
| `<audio-ui-knob>` | Rotary control |
| `<audio-ui-fader>` | Linear control, vertical by default, from -60 to +6 |
| `<audio-ui-envelope>` | Breakpoint envelope editor with curved segments |
| `<audio-ui-meter>` | Multichannel level meter with peak hold, warning and clip states |
| `<audio-ui-pad>` | Velocity-sensitive pad grid with choke groups |
| `<audio-ui-piano>` | Playable keyboard with glide and multi-touch chords |
| `<audio-ui-piano-roll>` | Note editor on a timeline, with keyboard and velocity lane |
| `<audio-ui-plot>` | Axes for curves, lines, bands, live traces, grids and draggable handles |
| `<audio-ui-sequencer>` | Step sequencer with velocities and a playback cursor |
| `<audio-ui-timeline>` | Arrangement view: ruler, tracks, clips with trims and fades, loop ranges, zoom and navigator |
| `<audio-ui-waveform>` | Seekable waveform on canvas or as bars, from peaks or a live signal, with regions and markers |
| `<audio-ui-xypad>` | Two-dimensional control |

## Documentation

API reference for every element and part: <https://www.audio-ui.dev/docs/custom-elements>.

## License

MIT
