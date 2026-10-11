# Components

Install any of these with `npx shadcn@latest add @audio/<name>` (registry) or import the primitive from `@audio-ui/react`. Docs: `https://audio-ui.xyz/docs/components/base/<name>`.

## Controls

| Name | Import | Use it for |
| --- | --- | --- |
| `knob` | `Knob` | A rotary parameter (level, cutoff, pan): circular, vertical or revolution drag, wheel, keyboard, double-click to reset |
| `fader` | `Fader` | A linear slider for gain or any parameter, vertical or horizontal |
| `xypad` | `XYPad` | Two parameters on one surface (filter cutoff and resonance, pan and send) |
| `envelope` | `Envelope` | A ramp edited by breakpoints: ADSR and other shapes, drag points, bend segments |

## Displays

| Name | Import | Use it for |
| --- | --- | --- |
| `meter` | `Meter` | Stereo or multi-channel dB level with peak hold, display only, fed by a source (`use-audio-levels` hook gives one from an `AnalyserNode`) |
| `waveform` | `Waveform` | A seekable waveform with regions and markers, a live scrolling one, or a bar visualizer (`waveform-dsp` lib turns a file into peaks) |
| `plot` | `Plot` | A curve with draggable points: equalizers, filters, compressors |

## Time and sequencing

| Name | Import | Use it for |
| --- | --- | --- |
| `timeline` | `Timeline` | A zoomable arrangement view: ruler that seeks on the grid, lanes, a playhead that moves without re-rendering (`musical-time` lib converts tempo to seconds) |
| `sequencer` | `Sequencer` | A step grid: press or drag across steps to draw a pattern |
| `piano` | `Piano` | A virtual keyboard with a MIDI pitch range, glissando, multi-touch, an `activeNotes` overlay |
| `piano-roll` | `PianoRoll` | A DAW-style note editor with grid, keyboard, velocity lane and keyboard editing |
| `transport` | registry only | DAW transport: return to start, play, stop, record, loop, bars and beats, tempo |
| `scrubber` | built on `Timeline` | Play or pause, position, a seek bar and the length |

## Ready blocks

`npx shadcn@latest add @audio/block-<name>` installs a composed screen. Available today: `block-pocket-synth`, `block-wave-shaper`, `block-waveform-player`, `block-piano-roll`, `block-timeline`. The full catalog (with demos) is at https://audio-ui.xyz/components, or ask the MCP `search_catalog` tool.
