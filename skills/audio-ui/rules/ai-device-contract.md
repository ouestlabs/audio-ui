---
title: A device is a state and a description, not a widget with audio inside
impact: MEDIUM
impactDescription: an effect a host can plug into its engine and an agent can drive, without rewriting it
tags: device, state, agent, tools, plug-in, daw
---

## A device is a state and a description, not a widget with audio inside

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
