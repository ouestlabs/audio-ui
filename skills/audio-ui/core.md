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
| `@audio-ui/core/piano-roll` | `createPianoRollController` |
| `@audio-ui/core/timeline` | `createTimelineController`, `createTrackController`, `createClipController`, `createRangeController`, `createNavigatorController`, `createWheelZoom` |
| `@audio-ui/core/waveform` | `createWaveformController`, `createWaveformRegionController`, `createLevelsEngine`, `createLevelHistory` |
| `@audio-ui/core/midi` | `parseMidiMessage`, `pitchBendToSemitones`, `parseMidiFile`, `encodeMidiFile`, `MidiFileError`, `createMidiInput` |
| `@audio-ui/core/time` | `secondsPerQuarter`, `barsBeatsAt`, `ticksToSeconds`, `secondsToTicks`, `gridInterval`, `gridLabel`, `advance`, `positionAt`, `SCHEDULE_AHEAD_SECONDS` |
| `@audio-ui/core/pitch` | `noteToFrequency`, `frequencyToNote`, `nearestNote`, `detectPitch`, `pitchName`, `CONCERT_PITCH_HZ` |

Never import `@audio-ui/core/internal`: it may change in any release.

## The controller contract

Every controller works the same way:

1. **Create it once** per mounted control: `create<Name>Controller()`, then `setOptions(options)` before the first draw.
2. **Draw from `getSnapshot()`**, and redraw when `subscribe` calls you. The snapshot is cached: the same object until something changes.
3. **Send it the input**: `press(event, element)` on a primary-button `pointerdown` (it follows the drag on the document until release; prepare the pointer first: [core-pointer-handler](./rules/core-pointer-handler.md)), `attachWheel(element)`, `keyDown(event)` from the focusable input (prevent the default when it returns `true`), `type(value, event)` from the input's `input` event.
4. **Update options with `setOptions(allOptions)`**: it replaces every option and notifies no one, so redraw yourself afterwards.
5. **Tear down** with the removers `subscribe` and `attachWheel` return.

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
