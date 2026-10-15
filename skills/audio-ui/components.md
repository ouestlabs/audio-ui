# Components

Docs for each: `https://www.audio-ui.dev/docs/components/base/<name>` (markdown: `/llm/components/base/<name>`).

## Where an installed component lives

`npx shadcn@latest add @audio-ui/<name>` copies the component to `components/audio-ui/<name>.tsx`. Import it from there:

```tsx
import { Knob } from "@/components/audio-ui/knob";
import { Meter } from "@/components/audio-ui/meter";
```

`@/components` is the `components` alias in the project's `components.json`: use the alias it declares. The CLI prints every file it writes; if a project installed components earlier, they may sit in another folder, so import from the path it printed. Components the one you add depends on (a block's knob, a plot's knob) land in the same folder. Hooks go to `hooks/`, libs to `lib/`, blocks to `components/examples/`.

Without the registry, the headless primitive comes from the package: `import { Knob } from "@audio-ui/react/knob"` (parts: `Knob.Root`, `Knob.Thumb`…).

## Controls

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `knob` | `Knob` from `@/components/audio-ui/knob` | `@audio-ui/react/knob` | A rotary parameter (level, cutoff, pan): circular, vertical or revolution drag, wheel, keyboard, double-click to reset |
| `fader` | `Fader` from `@/components/audio-ui/fader` | `@audio-ui/react/fader` | A linear slider for gain or any parameter, vertical or horizontal |
| `xypad` | `XYPad` from `@/components/audio-ui/xypad` | `@audio-ui/react/xypad` | Two parameters on one surface (filter cutoff and resonance, pan and send) |
| `envelope` | `Envelope` from `@/components/audio-ui/envelope` | `@audio-ui/react/envelope` | A ramp edited by breakpoints: ADSR and other shapes, drag points, bend segments |

## Displays

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `meter` | `Meter` from `@/components/audio-ui/meter` | `@audio-ui/react/meter` | Stereo or multi-channel dB level with peak hold, display only. Live levels come from a `source`, not from React state: `useAudioLevels(analysers)` from the `use-audio-levels` hook makes one |
| `waveform` | `Waveform`, `WaveformRegion`, `WaveformMarker`, `LiveWaveform`, `BarVisualizer` from `@/components/audio-ui/waveform` | `@audio-ui/react/waveform` | A seekable waveform with regions and markers, a live scrolling one, or a bar visualizer (`waveform-dsp` lib turns a file into peaks) |
| `spectrum-analyzer` | `SpectrumAnalyzer` from `@/components/audio-ui/spectrum-analyzer` | registry only, built on `Plot` | A live spectrum on a log frequency axis with held peaks. Feed it `useSpectrum(analyser)` from the `use-spectrum` hook, with the same `minHz`/`maxHz` |
| `tuner` | `Tuner` from `@/components/audio-ui/tuner` | registry only | A chromatic tuner's display: the nearest note, a needle on a scale of cents and the frequency, in the primary color when in tune. It follows a `source`: `usePitch(analyser)` from `use-pitch`, fed by `useMicrophone()` (start it from a click) or any `AnalyserNode` |
| `plot` | `Plot`, `PlotGraph`, `PlotCurve`, `PlotHandle`, `PlotTraceArea`… from `@/components/audio-ui/plot` | `@audio-ui/react/plot` | A curve with draggable points: equalizers, filters, compressors |

## Time and sequencing

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `timeline` | `Timeline`, `TimelineRuler`, `TimelineTrack`, `TimelineClip`, `TimelinePlayhead`… from `@/components/audio-ui/timeline` | `@audio-ui/react/timeline` | A zoomable arrangement view: ruler that seeks on the grid, lanes, a playhead that moves without re-rendering (`musical-time` lib converts tempo to seconds) |
| `sequencer` | `Sequencer` from `@/components/audio-ui/sequencer` | `@audio-ui/react/sequencer` | A step grid: press a step to flip it (on pointer down, so press it, don't `click`), drag across steps to paint a pattern, `Space` or `Enter` on the focused step. The playing step comes from a `source`, not state |
| `pad` | `Pad`, `PadItem` from `@/components/audio-ui/pad` | `@audio-ui/react/pad` | Drum pads to strike (on pointer down, so press them, don't `click`): velocity from pressure or height, `chokeGroup` to cut a ringing pad, `Space` or `Enter` on the focused pad, an `activePads` overlay |
| `piano` | `Piano` from `@/components/audio-ui/piano` | `@audio-ui/react/piano` | A virtual keyboard with a MIDI pitch range, glissando, multi-touch, an `activeNotes` overlay |
| `midi-connect-control` | `MidiConnectControl` from `@/components/audio-ui/midi-connect-control` | registry only | A button that connects the page's MIDI input, with the device's name beside it. Its `use-midi-input` hook gives the held notes (for `activeNotes`), note-on with velocity from 0 to 1, note-off and pitch bend |
| `piano-roll` | `PianoRoll`, `PianoRollKeys`, `PianoRollGrid`, `PianoRollVelocity`… from `@/components/audio-ui/piano-roll` | `@audio-ui/react/piano-roll` | A DAW-style note editor with grid, keyboard, velocity lane and keyboard editing |
| `transport` | `Transport` from `@/components/audio-ui/transport` | registry only | Play or pause, stop, the position in bars, beats and sixteenths, tempo and time signature, and loop and metronome toggles when you pass their handlers. The position follows a `source`, so a playing transport does not re-render |
| `bpm-control` | `BpmControl` from `@/components/audio-ui/bpm-control` | registry only | A tempo field on its own: type it, step it with the arrows, or drag its `BPM` unit. `transport` brings it |
| `scrubber` | `Scrubber` from `@/components/audio-ui/scrubber` | registry only, built on `Timeline` | Play or pause, position, a seek bar and the length |

## Ready blocks

`npx shadcn@latest add @audio-ui/block-<name>` installs a composed screen to `components/examples/block-<name>.tsx`, exported by name:

```tsx
import { BlockPocketSynth } from "@/components/examples/block-pocket-synth";
```

Available today: `block-pocket-synth`, `block-wave-shaper`, `block-waveform-player`, `block-piano-roll`, `block-timeline`, `block-drum-rack`, `block-mixer`. The full catalog (with demos) is at https://www.audio-ui.dev/components, or ask the MCP `search_catalog` tool.
