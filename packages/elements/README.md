# @audio-ui/elements

Headless, accessible audio controls as custom elements: the knob and the fader of audio/ui, for a page in plain HTML, Vue, Svelte or any framework that renders HTML.

- **Headless.** The elements set only what they need to work (display, position, the thumb's rotation) in rules with no specificity. State is in `data-*` attributes to style from, the same as the React parts.
- **Accessible.** Every control holds a native `<input type="range">`, so focus, the keyboard, screen readers and forms work as they do for a slider.
- **Composable.** Small parts that fit together (`<audio-ui-knob>`, `<audio-ui-knob-control>`, `<audio-ui-knob-thumb>`), the same parts as `@audio-ui/react`.
- **Built for audio.** The wheel and the keys step the value, a double click returns it to its default, and the knob takes a log scale and a fine drag with Shift.

## Install

```bash
npm install @audio-ui/elements
```

It is built on `@audio-ui/core`, the framework-agnostic logic of the controls, which installs with it.

## Use

Importing a subpath registers its elements:

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
knob.addEventListener("change", (event) => savePreset());
```

Every change fires `input`, with `event.detail.value` and `event.detail.reason` (`"drag"`, `"wheel"`, `"keyboard"`, `"reset"`); `preventDefault()` refuses it. `change` fires once a gesture that changed the value ends. `knob.value` reads the value, and setting it moves the knob.

## Elements

| Element | What it is |
| --- | --- |
| `<audio-ui-knob>` | A rotary parameter, with its control, track, indicator, thumb, value and label |
| `<audio-ui-fader>` | A linear parameter, vertical by default, from -60 to +6 |

## Documentation

Guides and the attributes of every part: <https://www.audio-ui.dev/docs/custom-elements>.

## License

MIT
