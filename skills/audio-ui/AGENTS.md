# audio/ui

**Version 1.2.0**  
audio/ui  
October 2026

> **Note:**  
> This document is for agents and LLMs building audio interfaces with audio/ui. It is generated from `rules/` by `bun run skill:build` in `apps/www`: edit the rules, not this file.

---

## Abstract

How to pick, install and wire audio/ui components in React, for AI agents and LLMs: how a control's value flows, accessibility, styling and letting a model drive the interface. Rules across four categories, prioritized by impact, each with the incorrect code an agent tends to write and the correct code with the real audio/ui API.

---

## Table of Contents

1. [Values & Events](#1-values--events): **HIGH**
   - 1.1 [Controlled or uncontrolled, never both](#11-controlled-or-uncontrolled-never-both)
   - 1.2 [Make the readout editable](#12-make-the-readout-editable)
   - 1.3 [Set dragMode="vertical" on knobs](#13-set-dragmodevertical-on-knobs)
   - 1.4 [Size step and largeStep to the range](#14-size-step-and-largestep-to-the-range)
   - 1.5 [Sound on change, persistence on commit](#15-sound-on-change-persistence-on-commit)
   - 1.6 [Logarithmic scales for frequency](#16-logarithmic-scales-for-frequency)
   - 1.7 [Rejecting a change](#17-rejecting-a-change)
   - 1.8 [Anchors for bipolar controls](#18-anchors-for-bipolar-controls)
2. [Accessibility](#2-accessibility): **HIGH**
   - 2.1 [Accessible names](#21-accessible-names)
   - 2.2 [Announce a live readout on change, not every frame](#22-announce-a-live-readout-on-change-not-every-frame)
   - 2.3 [Keep the focusable part](#23-keep-the-focusable-part)
   - 2.4 [Focus and hit areas](#24-focus-and-hit-areas)
3. [Styling](#3-styling): **MEDIUM**
   - 3.1 [Headless primitives: style by state](#31-headless-primitives-style-by-state)
   - 3.2 [Registry components: props before className](#32-registry-components-props-before-classname)
   - 3.3 [Semantic tokens only](#33-semantic-tokens-only)
   - 3.4 [Never edit the package](#34-never-edit-the-package)
4. [AI Control](#4-ai-control): **MEDIUM**
   - 4.1 [Keep the person in charge](#41-keep-the-person-in-charge)
   - 4.2 [Schemas come from the instance](#42-schemas-come-from-the-instance)
   - 4.3 [Tools edit state, not the DOM](#43-tools-edit-state-not-the-dom)
   - 4.4 [A device is a state and a description, not a widget with audio inside](#44-a-device-is-a-state-and-a-description-not-a-widget-with-audio-inside)
   - 4.5 [apply is pure and re-clamps](#45-apply-is-pure-and-re-clamps)
   - 4.6 [Give the model the current state](#46-give-the-model-the-current-state)
   - 4.7 [Wiring: AI SDK, Anthropic or OpenAI SDKs, MCP](#47-wiring-ai-sdk-anthropic-or-openai-sdks-mcp)

---

## 1. Values & Events

**Impact: HIGH**

How a control's value flows: controlled or uncontrolled, change versus commit, scales, anchors and rejected changes.

### 1.1 Controlled or uncontrolled, never both

**Impact: HIGH (no frozen or jumping controls)**

A control either owns its value (`defaultValue`) or follows yours (`value` + `onValueChange`). Passing `value` without updating it freezes the control; passing both makes it jump.

**Incorrect:**

```tsx
<Fader defaultValue={0} value={gain} />          // which one wins?
<Fader value={gain} />                           // frozen: nothing updates gain
```

**Correct:**

```tsx
<Fader defaultValue={0} />                                   // uncontrolled
<Fader onValueChange={setGain} value={gain} />               // controlled
```

`defaultValue` is still useful on a controlled Knob: it is the double-tap reset target.

### 1.2 Make the readout editable

**Impact: HIGH (exact values by keyboard, with no extra UI)**

A knob or fader is imprecise by hand: nobody lands on exactly 440 Hz or -6.0 dB with a drag. `Knob.Value` and `Fader.Value` take `editable`: a double-click, or Enter while the readout has focus, turns it into a field where a number is typed. Enter commits it (a unit or a decimal comma is fine, and it is clamped to the range), Escape drops it. It costs one prop and no extra control, and it is also the keyboard way to type a value. Style the field with a plain `input` inside the readout.

**Incorrect (a readout that can only be read):**

```tsx
<Knob.Root aria-label="Cutoff" defaultValue={1000} max={20000} min={20} scale="log">
  <Knob.Control>
    <Knob.Thumb />
  </Knob.Control>
  <Knob.Value />
</Knob.Root>
```

**Correct (type an exact value):**

```tsx
<Knob.Root aria-label="Cutoff" defaultValue={1000} max={20000} min={20} scale="log">
  <Knob.Control>
    <Knob.Thumb />
  </Knob.Control>
  <Knob.Value editable />
</Knob.Root>
```

### 1.3 Set dragMode="vertical" on knobs

**Impact: HIGH (a knob that follows the hand)**

A knob defaults to `dragMode="circular"`: the value follows the pointer's angle around the center, which asks for a circular gesture and jumps when the press lands off to one side. On a mouse and on a phone, people drag a knob up and down, like a fader. Set `dragMode="vertical"` on every `Knob.Root` unless the dial is large and the circular gesture is the point (`"revolution"` spans a full turn per range). The wheel and the keyboard work in every mode. Every knob part carries `data-drag-mode`, so the cursor can say how it turns: `ns-resize` for a vertical drag.

**Incorrect (the default circular drag on a small knob):**

```tsx
<Knob.Root aria-label="Cutoff" defaultValue={50}>
  <Knob.Control>
    <Knob.Thumb />
  </Knob.Control>
</Knob.Root>
```

**Correct (up and down, like a fader):**

```tsx
<Knob.Root aria-label="Cutoff" defaultValue={50} dragMode="vertical">
  <Knob.Control>
    <Knob.Thumb />
  </Knob.Control>
</Knob.Root>
```

```css
.knob-control { cursor: grab; }
.knob-control[data-drag-mode="vertical"] { cursor: ns-resize; }
```

### 1.4 Size step and largeStep to the range

**Impact: HIGH (a 0 to 1 control gets a hundred positions instead of two)**

`step` defaults to `1` and `largeStep` (Page Up/Down, Shift + arrows) to `10`: sized for the default 0 to 100 range. On a mix, pan or 0 to 1 gain control, `step={1}` leaves only the two ends, and `largeStep={10}` sends one key press straight to the end of the range. Set both whenever the range isn't 0 to 100 (XYPad: `stepX` and `stepY`).

**Incorrect (two positions, and Page Up jumps to the end):**

```tsx
<Knob aria-label="Mix" max={1} min={0} />
<Knob anchor={0} aria-label="Pan" max={1} min={-1} step={0.01} /> // Shift + arrow jumps to a hard pan
```

**Correct (a fine step and a large step about a tenth of the range):**

```tsx
<Knob aria-label="Mix" largeStep={0.1} max={1} min={0} step={0.01} />
<Knob anchor={0} aria-label="Pan" largeStep={0.1} max={1} min={-1} step={0.01} />
<XYPad aria-label="Filter" maxX={1} maxY={1} minX={0} minY={0} stepX={0.01} stepY={0.01} />
```

With `scale="log"` the keys and the wheel move a share of the travel instead (1%, or 10% with Shift and the Page keys), so `largeStep` matters only on linear scales.

### 1.5 Sound on change, persistence on commit

**Impact: HIGH (one write per gesture instead of hundreds)**

`onValueChange` fires on every step of a drag, wheel tick and key press. `onValueCommitted` fires once when the gesture ends. Writing to storage, undo history or the network on change turns one drag into hundreds of writes.

**Incorrect:**

```tsx
<Knob
  onValueChange={(v) => {
    setCutoff(v);
    history.push({ cutoff: v });      // hundreds of undo steps per drag
    fetch("/api/preset", { method: "PATCH", body: JSON.stringify({ cutoff: v }) });
  }}
  value={cutoff}
/>
```

**Correct:**

```tsx
<Knob
  onValueChange={(v) => {
    setCutoff(v);
    filter.frequency.setTargetAtTime(v, ctx.currentTime, 0.01);
  }}
  onValueCommitted={(v) => {
    history.push({ cutoff: v });
    savePreset({ cutoff: v });
  }}
  value={cutoff}
/>
```

A drag commits once, on release. A wheel tick, a key press and a reset are each a whole interaction (`eventDetails.reason` is `"wheel"`, `"keyboard"`, `"reset"`), so spinning the wheel or holding an arrow key commits on every step. When the write is expensive (a network request), also coalesce the commits:

```tsx
const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

<Knob
  onValueCommitted={(v) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePreset({ cutoff: v }), 300); // once, after a wheel spin stops
  }}
/>
```

### 1.6 Logarithmic scales for frequency

**Impact: MEDIUM (usable travel across the audible range)**

Hearing is logarithmic. On a linear 20 Hz to 20 kHz knob, the whole musical range sits in the first few degrees.

**Incorrect:**

```tsx
<Knob aria-label="Cutoff" max={20_000} min={20} />
```

**Correct:**

```tsx
<Knob aria-label="Cutoff" max={20_000} min={20} scale="log" />
```

`scale="log"` needs a positive `min`. Use it for frequency, Q and ratios. Level in dB is already logarithmic: keep it linear in dB.

### 1.7 Rejecting a change

**Impact: MEDIUM (the control and its announced value stay in sync)**

To refuse a value (a locked track, a value an app rule forbids), cancel the change. Ignoring it in state leaves the control and the announced value out of sync for a frame.

**Incorrect:**

```tsx
<Fader onValueChange={(v) => { if (!locked) setGain(v); }} value={gain} />
```

**Correct:**

```tsx
<Fader
  onValueChange={(v, eventDetails) => {
    if (locked) {
      eventDetails.cancel();
      return;
    }
    setGain(v);
  }}
  value={gain}
/>
```

`eventDetails.reason` says what caused the change (`"drag"`, `"keyboard"`, `"wheel"`, `"reset"`, `"input-change"`), and on a piano roll `eventDetails.edit` says what was edited.

### 1.8 Anchors for bipolar controls

**Impact: LOW (the center reads as the center)**

A pan or detune control is centered. Without an anchor, the indicator arc grows from the minimum, so "center" looks like "half way".

**Incorrect:**

```tsx
<Knob aria-label="Pan" defaultValue={0} max={1} min={-1} step={0.01} />
```

**Correct:**

```tsx
<Knob anchor={0} aria-label="Pan" defaultValue={0} largeStep={0.1} max={1} min={-1} step={0.01} />
```

---

## 2. Accessibility

**Impact: HIGH**

Every control stays usable with a keyboard, a screen reader and a finger, whatever it looks like.

### 2.1 Accessible names

**Impact: HIGH (controls usable with a screen reader)**

The primitives set the role, `aria-valuenow` and `aria-valuetext`. Only you know what the control is for.

**Incorrect:**

```tsx
<div className="flex gap-4">
  <Knob />
  <Knob />
</div>
```

**Correct:**

```tsx
<div className="flex gap-4">
  <Knob aria-label="Cutoff" />
  <Knob aria-label="Resonance" />
</div>
```

On the headless primitives the slider is named by `Knob.Label` or `Fader.Label`, or by `aria-label` on the thumb: an `aria-label` on the Root names only a group.

With several channels, a Meter names each one from its `aria-label` ("Master 1", "Master 2").

The value text is announced too. `format` takes `Intl.NumberFormat` options such as `{ maximumFractionDigits: 1 }` or `{ style: "percent" }`, but `Intl` has no hertz or decibel unit, and an unknown unit throws while the control renders. Put the unit in `formatValue` on the registry Knob and Fader (it prints the readout and the announced text), or in `getAriaValueText` on the primitive's thumb:

```tsx
<Knob
  aria-label="Cutoff"
  formatValue={(hz) => `${Math.round(hz)} Hz`}
  max={20_000}
  min={20}
  scale="log"
/>

<Knob.Thumb getAriaValueText={(formatted) => `${formatted} Hz`} />
```

### 2.2 Announce a live readout on change, not every frame

**Impact: HIGH (a screen reader that is usable, not flooded)**

A display that updates every frame (a tuner's cents, a loudness number, a position) is not a control, so the primitives' slider semantics do not cover it. Putting `aria-live` on it makes a screen reader read every frame. Give the visual display `aria-hidden="true"`, or `role="meter"` with `aria-valuenow` and `aria-valuetext`, and put the spoken version in a separate polite status that changes only when the meaning does: a new note, in tune or not, a level class.

**Incorrect (announced every frame):**

```tsx
<output aria-live="polite">{note.name} {note.cents.toFixed(1)} cents</output>
```

**Correct (the display is silent, a status speaks on a change):**

```tsx
<div aria-hidden="true">{note.name} {note.cents.toFixed(1)}</div>
<p className="sr-only" role="status">
  {inTune ? `${note.name}, in tune` : `${note.name}, ${note.cents > 0 ? "sharp" : "flat"}`}
</p>
```

The kit's `Vu` is a `figure` with `role="img"` and the label: it names the gauge without announcing every swing. Announce a threshold crossing (gain reduction beyond 10 dB, say) through a `role="status"` as above.

### 2.3 Keep the focusable part

**Impact: HIGH (keyboard and screen reader access survive restyling)**

The thumb holds the input that the keyboard and screen readers reach. Replacing it with a `div` keeps the look and loses the control.

**Incorrect:**

```tsx
<Fader.Control>
  <div className="my-thumb" style={{ bottom: `${percent}%` }} />
</Fader.Control>
```

**Correct:**

```tsx
<Fader.Control>
  <Fader.Thumb render={(props, state) => <MyThumb {...props} active={state.dragging} />} />
</Fader.Control>
```

`render` takes an element (`render={<span />}`) or a function of `(props, state)`. Always spread `props`.

### 2.4 Focus and hit areas

**Impact: MEDIUM (visible focus, and thumbs you can grab on touch)**

The headless primitives draw nothing, focus ring included. A thumb sized for the design (often 10 to 14px) is too small to grab with a finger.

**Incorrect (focus removed, hit area as small as the drawing):**

```css
.thumb {
  width: 12px;
  height: 12px;
  outline: none;
}
```

**Correct (a visible focus ring, a larger invisible hit area):**

```css
.thumb {
  position: relative;
  width: 12px;
  height: 12px;
}

.thumb:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* widen what the pointer can grab, not what is drawn */
.thumb::before {
  content: "";
  position: absolute;
  inset: -8px;
}
```

---

## 3. Styling

**Impact: MEDIUM**

Styling the registry components through their props and tokens, and the headless primitives through their state.

### 3.1 Headless primitives: style by state

**Impact: MEDIUM (state styles without extra renders)**

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
| Data attributes | `data-disabled`, `data-dragging`, `data-orientation` (Fader), `data-active` (Knob.Mark, live Waveform), `data-clipping` (Meter), `data-selected`, `data-scrubbing`, `data-in-scale` (PianoRoll.Row), `data-muted` (PianoRoll.Note), `data-has-selection` (PianoRoll.Root) |
| CSS variables | `--xy-pad-x` / `--xy-pad-y`, `--knob-mark-angle`, `--waveform-position`, `--waveform-level`, `--timeline-unit`, `--sequencer-velocity`, `--piano-roll-velocity`, `--piano-roll-chance`, `--piano-roll-level`, `--piano-roll-deviation` |

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

### 3.2 Registry components: props before className

**Impact: MEDIUM (keeps proportions and theme)**

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

### 3.3 Semantic tokens only

**Impact: MEDIUM (themes and dark mode keep working)**

**Incorrect:**

```tsx
<div className="bg-zinc-900 text-green-400">
  <Meter className="[&_[data-clipping]]:bg-red-500" />
</div>
```

**Correct:**

```tsx
<div className="bg-card text-card-foreground">
  <Meter />  {/* clipping already uses the destructive token */}
</div>
```

### 3.4 Never edit the package

**Impact: LOW (upgrades keep working)**

Changes made inside `node_modules/@audio-ui/react` (or a fork of it) vanish on the next install and block every upgrade. The look lives in your code: either the headless parts styled by state, or the registry component copied into the project.

**Incorrect (patching the installed package):**

```bash
# lost on the next install, conflicts with every upgrade
sed -i 's/strokeWidth = 4/strokeWidth = 6/' node_modules/@audio-ui/react/dist/index.js
```

**Correct (style the parts, or own a copy):**

```tsx
<Knob.Indicator strokeWidth={6} /> // the part's own prop
```

```bash
npx shadcn@latest add @audio-ui/knob   # then edit components/audio-ui/knob.tsx: it belongs to the project
```

---

## 4. AI Control

**Impact: MEDIUM**

Letting a model operate the components through typed tools that edit the same state a person does.

### 4.1 Keep the person in charge

**Impact: HIGH (no unattended recording, no loud playback, edits stay undoable)**

The person and the model edit the **same** state: every change shows in the component, undo works, and any value can be overridden by hand. Some actions never belong to the model.

**Incorrect (the model can record, play and set any level):**

```ts
const tools = {
  startRecording: { schema: z.object({}), apply: () => recorder.start() },
  setVolume: { schema: z.object({ db: z.number() }), apply: (s, { db }) => ({ ...s, db }) },
};
```

**Incorrect (undo recorded inside a state updater):**

```ts
setState((prev) => {
  history.push(prev); // an updater must be pure: React runs it twice in StrictMode, so every edit is recorded twice
  return tools[name].apply(prev, args);
});
```

**Correct (consent stays with a click, levels are bounded, one undo step per call):**

```ts
const tools = {
  setVolume: {
    description: "Set the output volume in dB.",
    schema: z.object({ db: z.number().min(-60).max(0) }), // never above 0 dB
    apply: (state, { db }) => ({ ...state, db }),
  },
};
```

```tsx
// npx shadcn@latest add @audio-ui/undo-history
import { emptyHistory, recordChange, settleChange, undo } from "@/lib/undo-history";

const historyRef = useRef(emptyHistory<PianoRollState>());

// in applyTool, before showing `next`: what it replaces is one step
historyRef.current = recordChange(
  settleChange(historyRef.current),
  stateRef.current
);
stateRef.current = next;
setState(next);

const undoLast = () => {
  const step = undo(historyRef.current, stateRef.current);
  if (step) {
    historyRef.current = step.history;
    stateRef.current = step.present;
    setState(step.present);
  }
};
```

The history lives in a ref and is updated from the handler, never from inside a `setState` updater. The person's own edits go through the same history, so one Undo takes back either.

Starting the microphone, recording, uploading and starting playback stay behind a button the person presses.

### 4.2 Schemas come from the instance

**Impact: HIGH (rejects hallucinated instruments and out-of-range steps)**

Bounds, enums and lengths come from the config of the component on screen. A hard-coded schema lets the model name instruments that don't exist or steps past the grid.

**Incorrect:**

```ts
const schema = z.object({
  instrument: z.enum(["kick", "snare", "hat"]), // this kit has a clap and no hat
  step: z.number(),                            // unbounded
});
```

**Correct:**

```ts
function createDrumTools({ instruments, stepCount }: { instruments: [string, ...string[]]; stepCount: number }) {
  const toggleStep = z.object({
    instrument: z.enum(instruments),
    step: z.number().int().min(0).max(stepCount - 1),
  });
  // ...
}
```

Build the tool set with a factory that takes the config. For a piano roll it is installable:

```bash
npx shadcn@latest add @audio-ui/piano-roll-tools   # needs zod
```

```ts
const tools = createPianoRollTools({ minPitch: 36, maxPitch: 72, stepCount: 32 });
// setNotes, addNotes, removeNotes, transpose, clear, setTempo
// state: { bpm, notes: { id, pitch, start, length, velocity }[] }, start/length in grid steps
```

### 4.3 Tools edit state, not the DOM

**Impact: HIGH (UI, audio and undo never fall out of sync)**

audio/ui components are controlled: their whole state is a plain value. The model produces the next value through tools; React renders it and the audio follows, exactly as when a person drags.

```
text ─▶ model ─▶ { name, args } ─▶ schema.parse ─▶ apply(state, args) ─▶ setState ─▶ component + audio
```

Each tool is `{ description, schema, apply }`: a sentence for the model, a zod schema of its arguments, and a pure reducer. One function turns a call into the next state, wherever the state lives.

**Incorrect (the model drives the interface the way a user would):**

```ts
execute: async ({ selector, value }) => {
  document.querySelector(selector)?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
};
```

**Correct (a call becomes the next state):**

```tsx
const [state, setState] = useState<PianoRollState>({ bpm: 120, notes: [] });
// The latest state, for calls that arrive before the next render: a model can
// call two tools in one step, and a state variable is stale until then.
const stateRef = useRef(state);

/** One tool call from the model. Throwing sends the message back, and the model retries. */
const applyTool = (name: string, input: unknown) => {
  // `tools["constructor"]` is truthy: only the tools you made count.
  if (!Object.hasOwn(tools, name)) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const tool = tools[name as keyof typeof tools];
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  const next = tool.apply(stateRef.current, parsed.data as never);
  stateRef.current = next;
  setState(next);
  return `${name} applied`;
};
```

The state lives in the browser, so this function does too. How a call from a server-side model reaches it is the rule `ai-structured-tool-calls`.

### 4.4 A device is a state and a description, not a widget with audio inside

**Impact: MEDIUM (an effect a host can plug into its engine and an agent can drive, without rewriting it)**

A component that creates its own nodes, keeps its own state and plays its own demo signal can only be used as it is: a DAW cannot give it a project's state or take its engine out, and an agent has no values to read or ranges to respect. Describe the device once, as parameters, and let a panel, an engine and an agent each use that description.

**Incorrect (state, nodes and ranges inside one component):**

```tsx
function Compressor() {
  const [threshold, setThreshold] = useState(-18); // the host cannot read or set this
  useEffect(() => {
    const node = ctx.createDynamicsCompressor();
    node.threshold.value = threshold; // a jump, and a range only this file knows
    // ...
  }, [threshold]);
  return <Knob min={-60} max={0} value={threshold} onValueChange={setThreshold} />;
}
```

**Correct (a device: a state, a controlled panel, an engine, tools):**

```bash
npx shadcn@latest add @audio-ui/block-compressor
```

```tsx
import { deviceTools } from "@audio-ui/core/device";
import { CompressorPanel } from "@/components/audio-ui/devices/compressor/panel";
import { compressorDevice } from "@/components/audio-ui/devices/compressor/device";
import { createCompressorEngine } from "@/components/audio-ui/devices/compressor/engine";

const [state, setState] = useState(() => compressorDevice.defaults()); // a plain object: store it, save it
<CompressorPanel onValueChange={setState} value={state} />; // controlled, no audio inside

const engine = createCompressorEngine(ctx, state); // plays a state; ramps, no click
engine.update(state);

const [set] = deviceTools(compressorDevice); // for any agent: JSON Schema in, a sentence out
const { state: next, summary } = set.run(state, modelInput); // clamped, refused by name, never throws
```

A device of your own is `defineDevice({ id, name, description, parameters })` from `@audio-ui/core/device`: `DevicePanel` and `deviceTools` work on it with no further code, and a host with its own engine implements `DeviceBinding` (`update(state)`, `dispose()`) instead of using the Web Audio one. Keep the state a plain object keyed by parameter id and store the device's `id`, not the panel that draws it.

An instrument is a device with `kind: "instrument"`: its parameters shape the timbre (a `choice` parameter holds a waveform or a filter type) and its engine adds `noteOn(note)` and `noteOff()` next to `update(state)`. `block-pocket-synth` is the reference: the panel is controlled and sends notes out through `onNoteOn` and `onNoteOff`, so it plays through any engine, or none.

An agent can play an instrument that declares its `note` (a pitch, a cutoff, each with a range): `deviceTools` then returns a third tool, `<id>_play`, whose call gives back the note and how long it lasts, in bounds and refused by name when wrong, for the host to give to `playNote(engine, note, seconds)`. A parameter that is a pick from a list (a waveform, a filter type) is `kind: "choice"` with its `options`; the state holds the option's value, and a value that is not an option is refused, not replaced.

A host that brings its own engine can measure it against the panel: `measureResponse(createEngine, state, curve)` from `device-measure` returns how far, in dB, its response is from the curve the device draws, and `measureLatency(createEngine, state)` how long it delays a signal, both rendered offline. It is a measurement, not a certification: the curve is the device's own and the tolerance is the host's.

A time parameter that follows the tempo is a `choice` of `SYNCED_DIVISIONS` from `@audio-ui/core/time` (`1/8`, `1/8t` triplet, `1/8d` dotted) beside a toggle; the host gives the engine its tempo as `update(state, { tempo })`, never as a tool parameter, and `syncedSeconds(division, tempo)` is how long one lasts. A device that delays the sound declares `latency(state, sampleRate)` in seconds, and `device.latency(state, sampleRate)` is what a host that compensates latency asks for.

A device that listens to a second signal (a gate opened by a kick) declares `sidechain: true` in `defineDevice`, and its engine has a `sidechain` input to connect the key to (`SidechainBinding`). The key is a signal, never a parameter: the state holds only the switch that says to listen to it, and an agent can switch it on but the host routes the signal.

### 4.5 apply is pure and re-clamps

**Impact: MEDIUM (every tool call yields a valid state)**

A schema catches wrong types; it can't catch every odd combination (a note that starts in range and ends past the grid). Clamp and snap again in `apply`, the way the component would.

**Incorrect:**

```ts
apply: (state, { notes }) => ({ ...state, notes: [...state.notes, ...notes] }),
```

**Correct:**

```ts
apply: (state, { notes }) => ({
  ...state,
  notes: [...state.notes, ...notes.map((n, i) => clampNoteToDomain(n, nextId(state) + i, domain))],
}),
```

Pure reducers are testable without a model: test them like any function.

### 4.6 Give the model the current state

**Impact: MEDIUM (relative edits land on the right notes and values)**

"Remove the last two notes", "a bit brighter" and "double the tempo" are relative to what is there. Without the current state, the model guesses ids and values, or rewrites everything.

**Incorrect (the model edits blind):**

```ts
const result = await generateText({
  model,
  tools: aiTools,
  system: "You edit a piano roll.",
  prompt: userText,
});
```

**Correct (the state the tools act on is in context):**

```ts
const result = await generateText({
  model,
  tools: aiTools,
  system: [
    "You edit a piano roll. Pitches are MIDI numbers, start and length are grid steps.",
    `Range: ${minPitch} to ${maxPitch}, ${stepCount} steps.`,
    `Current state: ${JSON.stringify({ bpm: state.bpm, notes: state.notes })}`,
  ].join("\n"),
  prompt: userText,
});
```

For large states, expose a read tool (`getNotes`, `getMix`) instead of inlining everything.

### 4.7 Wiring: AI SDK, Anthropic or OpenAI SDKs, MCP

**Impact: MEDIUM (validated arguments instead of parsed prose, run where the state lives)**

Asking the model to answer in JSON and parsing its text breaks on the first stray sentence, and nothing checks the values. Tool calls carry arguments the schema validates before anything touches state.

The state of a component lives in the browser, but the model is called from a server route (the API key can't ship to the page). So the server declares the tools with their schemas and **no** `execute`, and the browser runs each call on its state and sends the result back.

**Incorrect (prose parsed as JSON):**

```ts
const { text } = await generateText({ model, prompt: `${userText}\nAnswer with JSON notes.` });
setState((prev) => ({ ...prev, notes: JSON.parse(text) })); // throws, or writes anything
```

**Incorrect (an `execute` that needs browser state, on the server):**

```ts
tool({
  description: t.description,
  inputSchema: t.schema,
  execute: async (args) => setState((prev) => t.apply(prev, args)), // no setState in a route
});
```

**Correct (Vercel AI SDK: schemas on the server, the call runs in the browser):**

```ts
// app/api/chat/route.ts
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import type { ZodType } from "zod";
import { pianoRollTools } from "@/lib/piano-roll-ai"; // createPianoRollTools(your roll's config)
import type { PianoRollState } from "@/lib/piano-roll-tools";

// No `execute`. The schemas are widened to ZodType: `tool()` can't infer one
// input type from six different schemas.
const tools = Object.fromEntries(
  Object.entries(pianoRollTools).map(([name, t]) => [
    name,
    tool({ description: t.description, inputSchema: t.schema as ZodType }),
  ])
);

export async function POST(request: Request) {
  const { messages, state }: { messages: UIMessage[]; state: PianoRollState } =
    await request.json();

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: "anthropic/claude-sonnet-4.5", // a model id on the AI Gateway, or a provider's model
    system: `You edit a piano roll through tools. Current state: ${JSON.stringify(state)}`,
    tools,
  });
  return result.toUIMessageStreamResponse();
}
```

```tsx
// components/use-roll-chat.ts
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";

export function useRollChat(
  applyTool: (name: string, input: unknown) => string, // from the rule ai-tools-edit-state
  getState: () => PianoRollState
) {
  const chat = useChat({
    onToolCall: ({ toolCall }) => {
      const { toolCallId, toolName } = toolCall;
      try {
        // Not awaited: waiting on the output inside onToolCall can deadlock the chat.
        chat.addToolOutput({ output: applyTool(toolName, toolCall.input), tool: toolName, toolCallId });
      } catch (cause) {
        chat.addToolOutput({
          errorText: cause instanceof Error ? cause.message : "The tool call failed.",
          state: "output-error",
          tool: toolName,
          toolCallId,
        });
      }
    },
    // Once every call has its output, the model gets them back and answers.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ body, messages }) => ({
        body: { ...body, messages, state: getState() }, // the roll as it is now
      }),
    }),
  });
  return chat;
}
```

Written against AI SDK 6 and 7 (`inputSchema`, `addToolOutput`).

**Correct (Anthropic or OpenAI SDKs, MCP servers):** send `z.toJSONSchema(t.schema)` (zod 4) as each tool's input schema. On a tool call, wherever the state lives:

```ts
const parsed = t.schema.safeParse(input);
if (!parsed.success) {
  return { isError: true, content: parsed.error.message }; // the model retries
}
const next = t.apply(current, parsed.data);
return { content: "applied" };
```

Prefer few, coarse tools (`setNotes` replaces the whole roll) over many tiny ones: models do better writing a whole phrase at once.

---

## References

1. https://www.audio-ui.dev/docs
2. https://www.audio-ui.dev/llms.txt
3. https://www.w3.org/WAI/ARIA/apg/patterns/slider/
