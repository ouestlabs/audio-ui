# Without React: @audio-ui/core

`@audio-ui/core` is the logic of every audio/ui control with no UI framework in it: value math, scales, pointer, wheel and keyboard handling, live sources. `@audio-ui/react` is one adapter over it. Use it directly for Vue, Svelte, Solid, Angular, web components or the plain DOM.

```bash
npm install @audio-ui/core   # no dependencies
```

## What it exports

| Entry | What |
| --- | --- |
| `@audio-ui/core` | Shared pieces: `createSource`, `createStore`, `resolveScale` / `LINEAR_SCALE` / `LOGARITHMIC_SCALE`, `clamp`, `roundToStep`, `createFrameTask`, `observeVisibility`, `pitchName`, `isBlackKey`, change and commit event details |
| `@audio-ui/core/knob` | `createKnobController`, geometry (`START_ANGLE`, `SWEEP_ANGLE`, `arcPath`), `STATE_ATTRIBUTES_MAPPING` |
| `@audio-ui/core/fader` | `createFaderController` |
| `@audio-ui/core/xypad` | `createXYPadController` |
| `@audio-ui/core/envelope` | `createEnvelopeController` |
| `@audio-ui/core/meter` | `createMeterConfig` |
| `@audio-ui/core/plot` | `createPlotHandleController` |
| `@audio-ui/core/sequencer` | `createSequencerController` |
| `@audio-ui/core/pad` | `createPadController` |
| `@audio-ui/core/piano` | `createPianoController` |
| `@audio-ui/core/piano-roll` | `createPianoRollController`; edits that return new notes: `splitNotes`, `chopNotes`, `joinNotes`, `legatoNotes`, `reverseNotes`, `invertNotes`, `stretchNotes`, `fitNotesToScale`, `rampVelocity`, `humanizeNotes`, `toggleMuted`, `setChance`, `setDeviation`, `deleteTime`, `insertTime`, `duplicateTime`; `findNotes`, `selectionSpan` |
| `@audio-ui/core/timeline` | `createTimelineController`, `createTrackController`, `createClipController`, `createRangeController`, `createNavigatorController`, `createWheelZoom` |
| `@audio-ui/core/waveform` | `createWaveformController`, `createWaveformRegionController`, `createLevelsEngine`, `createLevelHistory` |
| `@audio-ui/core/analysis` | `logSpectrum`, `holdPeaks`, `computePeaks`, `downsampleWaveform`, `spectrumBands`, `biquadResponse`, `eqResponse`, `toWebAudioQ`, `compressorOutput`, `webAudioCompressorOutput`, `dbToGain`, `gainToDb`, `rmsDb`, `formatHz`, `formatDb` |
| `@audio-ui/core/device` | `defineDevice`, `deviceTools`, `DeviceDefinitionError`, `Device`, `DeviceBinding`, `DeviceState`, `DeviceDescription`, `ParameterDescriptor` |
| `@audio-ui/core/midi` | `parseMidiMessage`, `pitchBendToSemitones`, `parseMidiFile`, `encodeMidiFile`, `MidiFileError`, `createMidiInput` |
| `@audio-ui/core/time` | `secondsPerQuarter`, `barsBeatsAt`, `ticksToSeconds`, `secondsToTicks`, `gridInterval`, `gridLabel`, `advance`, `positionAt`, `SCHEDULE_AHEAD_SECONDS` |
| `@audio-ui/core/pitch` | `noteToFrequency`, `frequencyToNote`, `nearestNote`, `detectPitch`, `pitchName`, `CONCERT_PITCH_HZ`, `SCALES`, `inScale`, `nearestInScale`, `scalePitchClasses` |

Never import `@audio-ui/core/internal`: it may change in any release.

## The controller contract

Every controller works the same way:

1. **Create it once** per mounted control: `create<Name>Controller()`, then `setOptions(options)` before the first draw.
2. **Draw from `getSnapshot()`**, and redraw when `subscribe` calls you. The snapshot is cached: the same object until something changes.
3. **Send it the input**: `press` on a primary-button `pointerdown` (it follows the drag on the document until release; prepare the pointer first: [core-pointer-handler](./rules/core-pointer-handler.md)), `attachWheel(element)`, `keyDown` from the focusable input (prevent the default when it returns `true`), and `type` from the input's `input` event. The arguments differ per controller, as the table below shows.
4. **Update options with `setOptions(allOptions)`**: it replaces every option and notifies no one, so redraw yourself afterwards.
5. **Tear down** with the removers `subscribe` and `attachWheel` return.

### Input signatures per controller

| Controller | `press` | `keyDown` | `type` | Reset (double-click, Alt, Delete) |
| --- | --- | --- | --- | --- |
| `createKnobController` | `press(event, control)` | `keyDown(event)` | `type(value, event)` | in the controller |
| `createFaderController` | `press(event, control, thumb)` | `keyDown(event, element)` | `type(value, event)` | `reset(event)`, called by the element |
| `createXYPadController` | `press(event, control)` | `keyDown(event)` | `type(axis, value, event)` | `reset(event)`, called by the element |
| `createPlotHandleController` | `press(event, element)` | `keyDown(event)` | `typeAt(along, position, event)` | `reset(event)`, called by the element |

The knob resets on a double tap by itself, because a tap on a knob changes nothing. For the fader, the pad and the plot handle a tap sets the value, so they have no double-tap reset: listen for `dblclick` on the control and call `reset(event)`. The pad and the plot handle reset on Alt with a press and on Delete themselves; for the fader, the element calls `reset(event)` on both.

Read the signatures in the `*Controller` type of each module before calling one: they are the source of truth.

The React primitives are the reference implementation of each adapter: `packages/ui/src/primitives/<name>/elements/` in https://github.com/ouestlabs/audio-ui shows which part gets which listener and attribute.

## A knob in the plain DOM

```html
<div class="knob" id="cutoff">
  <div data-part="control" style="touch-action: none">
    <svg data-part="track" viewBox="0 0 48 48"><!-- arc drawn with arcPath() --></svg>
    <div data-part="thumb">
      <input type="range" aria-label="Cutoff" class="visually-hidden" />
    </div>
  </div>
  <output data-part="value"></output>
</div>
```

```ts
import { createKnobController, type KnobOptions } from "@audio-ui/core/knob";

export function mountKnob(root: HTMLElement, options: KnobOptions) {
  const control = root.querySelector<HTMLElement>("[data-part=control]");
  const thumb = root.querySelector<HTMLElement>("[data-part=thumb]");
  const input = root.querySelector<HTMLInputElement>("input[type=range]");
  const output = root.querySelector<HTMLOutputElement>("[data-part=value]");
  if (!(control && thumb && input && output)) {
    throw new Error("mountKnob: missing control, thumb, input or value");
  }
  let current = options;
  // Create it empty and set the options before the first draw, as the React
  // primitives do: every option applies, `scale` included, on any release.
  const knob = createKnobController();
  knob.setOptions(current);

  const render = () => {
    const s = knob.getSnapshot();
    thumb.style.rotate = `${s.angle}deg`;
    output.textContent = s.formatted;
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.value = String(s.value);
    input.disabled = s.disabled;
    input.setAttribute("aria-valuetext", s.formatted);
    root.toggleAttribute("data-dragging", s.dragging);
    root.toggleAttribute("data-disabled", s.disabled);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault(); // no text selection or native drag while turning
    input.focus({ preventScroll: true }); // the arrow keys work right after a click
    knob.press(event, control);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (knob.keyDown(event)) {
      event.preventDefault();
    }
  };
  const onInput = (event: Event) => knob.type(Number(input.value), event);

  const unsubscribe = knob.subscribe(render);
  const detachWheel = knob.attachWheel(control);
  control.addEventListener("pointerdown", onPointerDown);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("input", onInput);
  render();

  return {
    // setOptions replaces every option and notifies no one: pass them all, then redraw.
    update(next: Partial<KnobOptions>) {
      current = { ...current, ...next };
      knob.setOptions(current);
      render();
    },
    destroy() {
      unsubscribe();
      detachWheel();
      control.removeEventListener("pointerdown", onPointerDown);
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("input", onInput);
    },
  };
}
```

```ts
const cutoff = mountKnob(document.getElementById("cutoff")!, {
  defaultValue: 1000,
  max: 20_000,
  min: 20,
  scale: "log",
  onValueChange: (hz) => filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.01),
  onValueCommitted: (hz) => savePreset({ cutoff: hz }),
});
```

## The kit's look in the plain DOM

The skins in `styles/` select class names, not React parts, so they work on plain DOM: build the same tree with the kit's classes, copy `styles/base.css`, `styles/dom.css` and one skin, and put the skin's class on the panel (`<section class="panel skin-retro">`). These two functions build a knob and a fader that way. They are the verified starting point: `s.angle` is the rotation to apply to the thumb, `s.percent` and `s.anchorPercent` (0 to 1) bound the value arc drawn with `arcPath`, and a fader's `s.share` (0 to 100) is the cap's position along the strip, with `s.fill` the lit part of the slot.

```html
<section class="panel skin-modern">
  <h2 class="panel-title">Synth</h2>
  <div class="panel-row">
    <div class="knob" id="synth-cutoff"></div>
    <div class="knob" id="resonance"></div>
    <div class="fader" id="level"></div>
  </div>
</section>
```

Set the page's `background` and `color-scheme` yourself: a skin styles the panel, not the page. A momentary key (hold to play) is a `.toggle` button whose `aria-pressed` you set on `pointerdown` and `keydown`, and clear on `pointerup`, `pointerleave`, `keyup` and `blur`.

```ts
import { createFaderController, type FaderOptions } from "@audio-ui/core/fader";
import {
  arcPath,
  createKnobController,
  type KnobOptions,
  START_ANGLE,
  SWEEP_ANGLE,
} from "@audio-ui/core/knob";

const SVG_NS = "http://www.w3.org/2000/svg";
const MARKS = [0, 0.25, 0.5, 0.75, 1];

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement
) {
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
}

function arc(className: string, parent: HTMLElement) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  svg.append(path);
  parent.append(svg);
  return path;
}

// `root` is an empty element with class "knob"; `label` names the slider and prints under the dial.
export function mountKitKnob(
  root: HTMLElement,
  label: string,
  options: KnobOptions,
  unit = ""
) {
  const control = element("div", "knob-control", root);
  control.style.touchAction = "none";
  // The controller takes dragMode; the attribute is only for the cursor in the CSS.
  control.dataset.dragMode = options.dragMode ?? "circular";
  const track = arc("knob-track", control);
  const indicator = arc("knob-indicator", control);
  const thumb = element("div", "knob-thumb", control);
  const input = element("input", "visually-hidden", thumb);
  input.type = "range";
  input.setAttribute("aria-label", label);
  for (const position of MARKS) {
    const mark = element("div", "knob-mark", control);
    mark.style.rotate = `${START_ANGLE + position * SWEEP_ANGLE}deg`;
    mark.setAttribute("aria-hidden", "true");
    element("span", "knob-tick", mark);
  }
  element("span", "knob-label", root).textContent = label;
  const output = element("output", "knob-value", root);
  track.setAttribute("d", arcPath(21, 0, 1));

  const knob = createKnobController();
  knob.setOptions(options);

  const render = () => {
    const s = knob.getSnapshot();
    thumb.style.rotate = `${s.angle}deg`;
    indicator.setAttribute(
      "d",
      arcPath(21, Math.min(s.anchorPercent, s.percent), Math.max(s.anchorPercent, s.percent))
    );
    output.textContent = s.formatted + unit;
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.value = String(s.value);
    input.disabled = s.disabled;
    input.setAttribute("aria-valuetext", s.formatted + unit);
    control.toggleAttribute("data-dragging", s.dragging);
    control.toggleAttribute("data-disabled", s.disabled);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    input.focus({ preventScroll: true });
    knob.press(event, control);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (knob.keyDown(event)) {
      event.preventDefault();
    }
  };
  const onInput = (event: Event) => knob.type(Number(input.value), event);

  const unsubscribe = knob.subscribe(render);
  const detachWheel = knob.attachWheel(control);
  control.addEventListener("pointerdown", onPointerDown);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("input", onInput);
  render();

  return () => {
    unsubscribe();
    detachWheel();
    control.removeEventListener("pointerdown", onPointerDown);
    input.removeEventListener("keydown", onKeyDown);
    input.removeEventListener("input", onInput);
  };
}

export function mountKitFader(
  root: HTMLElement,
  label: string,
  options: FaderOptions,
  unit = ""
) {
  const control = element("div", "fader-control", root);
  control.style.touchAction = "none";
  const track = element("div", "fader-track", control);
  // React sets this inline on the track; the indicator is positioned against it.
  track.style.position = "relative";
  const indicator = element("div", "fader-indicator", track);
  const thumb = element("div", "fader-thumb", control);
  const input = element("input", "visually-hidden", thumb);
  input.type = "range";
  input.setAttribute("aria-label", label);
  input.setAttribute("aria-orientation", "vertical");
  element("span", "knob-label", root).textContent = label;
  const output = element("output", "knob-value", root);

  const fader = createFaderController();
  fader.setOptions(options);

  const render = () => {
    const s = fader.getSnapshot();
    // React sets this inline on the thumb; in the plain DOM it is yours. The cap travels inside the control.
    thumb.style.bottom = `calc((100% - var(--fader-thumb-h)) * ${s.share / 100})`;
    thumb.style.left = "50%";
    thumb.style.translate = "-50% 0";
    indicator.style.height = `${s.fill.to - s.fill.from}%`;
    indicator.style.bottom = `${s.fill.from}%`;
    output.textContent = s.formatted + unit;
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.value = String(s.value);
    input.disabled = s.disabled;
    input.setAttribute("aria-valuetext", s.formatted + unit);
    control.toggleAttribute("data-dragging", s.dragging);
    control.toggleAttribute("data-disabled", s.disabled);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    input.focus({ preventScroll: true });
    // Alt and a press reset the fader, as Delete does from the keyboard
    if (event.altKey) {
      fader.reset(event);
      return;
    }
    fader.press(event, control, thumb);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Delete") {
      event.preventDefault();
      fader.reset(event);
      return;
    }
    if (fader.keyDown(event, input)) {
      event.preventDefault();
    }
  };
  const onInput = (event: Event) => fader.type(Number(input.value), event);
  const onDoubleClick = (event: MouseEvent) => fader.reset(event);

  const unsubscribe = fader.subscribe(render);
  const detachWheel = fader.attachWheel(control);
  control.addEventListener("pointerdown", onPointerDown);
  control.addEventListener("dblclick", onDoubleClick);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("input", onInput);
  render();

  return () => {
    unsubscribe();
    detachWheel();
    control.removeEventListener("pointerdown", onPointerDown);
    control.removeEventListener("dblclick", onDoubleClick);
    input.removeEventListener("keydown", onKeyDown);
    input.removeEventListener("input", onInput);
  };
}
```

Pass `dragMode: "vertical"` in the knob's options (the controller reads it, and the `data-drag-mode` attribute above only draws the cursor), and `locale: "en-US"` so the readout does not follow the browser's decimal mark. Pass the unit as the last argument (`mountKitKnob(root, "Cutoff", options, " Hz")`). `format` is an `Intl.NumberFormatOptions` object (`{ maximumFractionDigits: 0, useGrouping: false }` prints 4565, not 4,565). The editable readout and the registry's value formats are React only.


### Numerals and sections in the plain DOM

The factories above make five marks. For printed numerals, give each mark the variable its angle and put a `span.knob-numeral` in it: the skins counter-rotate the numeral with `--knob-mark-angle`, and nothing else sets it outside React.

```ts
function numerals(control: HTMLElement, marks: { value: number; label: string }[]) {
  for (const { value, label } of marks) {
    const position = (value - MIN) / (MAX - MIN); // the knob's own scale, here linear 0 to 1
    const mark = element("div", "knob-mark", control);
    mark.style.setProperty("--knob-mark-angle", `${START_ANGLE + position * SWEEP_ANGLE}deg`);
    mark.style.rotate = `${START_ANGLE + position * SWEEP_ANGLE}deg`;
    element("span", "knob-tick", mark);
    element("span", "knob-numeral", mark).textContent = label;
  }
}
```

Give every section the layout the skins expect: `<section class="section">` with `display: flex` and a top padding of about 2.5rem, so the numerals of its knobs clear the legend, and the legend as `<span class="legend">` inside it. Keep `.panel-row` for top-level rows only: nested in a section it picks up the row's margins and alignment.

## Vue

```ts
import { createKnobController, type KnobOptions } from "@audio-ui/core/knob";
import { onScopeDispose, shallowRef, toValue, watchEffect, type MaybeRefOrGetter } from "vue";

export function useKnob(options: MaybeRefOrGetter<KnobOptions>) {
  const knob = createKnobController();
  const snapshot = shallowRef(knob.getSnapshot());
  const sync = () => {
    snapshot.value = knob.getSnapshot();
  };
  onScopeDispose(knob.subscribe(sync));
  // Runs now, before the first render, and again when what `options` reads changes.
  watchEffect(() => {
    knob.setOptions(toValue(options));
    sync();
  });
  return { knob, snapshot };
}
```

Bind `snapshot.value.angle`, `.formatted` and the rest in the template; call `knob.press` (prepared as in the plain DOM `onPointerDown`), `knob.keyDown` and `knob.type` from `@pointerdown`, `@keydown` and `@input`, and `knob.attachWheel` in `onMounted`. Use `shallowRef`: a deep `reactive` copy of the snapshot breaks its caching.

## Svelte 5

```ts
// knob.svelte.ts
import { createKnobController, type KnobOptions } from "@audio-ui/core/knob";

export function createKnob(getOptions: () => KnobOptions) {
  const knob = createKnobController();
  knob.setOptions(getOptions()); // before the first draw: an effect only runs after mount
  let snapshot = $state.raw(knob.getSnapshot());
  const sync = () => {
    snapshot = knob.getSnapshot();
  };
  $effect(() => knob.subscribe(sync));
  $effect(() => {
    knob.setOptions(getOptions());
    sync();
  });
  return {
    knob,
    get snapshot() {
      return snapshot;
    },
  };
}
```

Call it during component setup. `$state.raw` keeps the snapshot as is instead of a deep proxy.

## Live data without React

`createSource` is the same in every framework: push readings with `set`, and anything that follows the source redraws outside your framework's render cycle. Pair it with `createFrameTask` to batch DOM writes to the next animation frame.

The Web Audio rules of this skill (`audio-*`) apply unchanged: they are about the audio graph, not the UI framework.
