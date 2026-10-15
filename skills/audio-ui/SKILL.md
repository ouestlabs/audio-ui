---
name: audio-ui
description: "Builds audio interfaces with audio/ui: React (@audio-ui/react and the @audio-ui shadcn registry) or any other framework and the plain DOM (@audio-ui/core): knobs, faders, XY pads, envelopes, level meters, waveforms, EQ and filter plots, timelines, step sequencers, drum pads, piano keyboards, piano rolls, transport bars, and the synths, mixers, DAWs, samplers and players made from them. Covers picking and installing components, wiring them to the Web Audio API, live meters and playheads, styling the headless primitives, building controls for Vue, Svelte, Solid, Angular, web components or vanilla JS on the framework-free controllers, and letting an AI model drive them through tools. Applies whenever the user wants any audio control or display on the web, even without naming audio/ui, and whenever a project imports @audio-ui/react or @audio-ui/core or has an @audio-ui registry in components.json."
license: MIT
metadata:
  author: audio/ui
  version: "1.0.0"
allowed-tools: Bash(npx shadcn@latest *), Bash(pnpm dlx shadcn@latest *), Bash(bunx --bun shadcn@latest *), Bash(yarn dlx shadcn@latest *)
---

# audio/ui

Accessible, composable audio controls, in three layers:

| Layer | What it is | Pick it when |
| --- | --- | --- |
| `@audio-ui` registry (shadcn) | Styled components and blocks copied into the project | The project has a `components.json` (shadcn/ui, Tailwind v4) |
| `@audio-ui/react` (npm) | Headless React primitives: behavior, input handling and ARIA, no styles | React without shadcn, or the project brings its own design system |
| `@audio-ui/core` (npm) | Framework-free controllers: value math, scales, pointer, wheel and keyboard handling, live sources | Vue, Svelte, Solid, Angular, web components or the plain DOM → [core.md](./core.md) |

Run commands with the project's package manager, read from its lockfile: `npx shadcn@latest`, `pnpm dlx shadcn@latest`, `bunx --bun shadcn@latest` or `yarn dlx shadcn@latest`. Examples use `npx`.

## When to Apply

- Adding a knob, fader, XY pad, envelope, meter, waveform, plot, timeline, sequencer, drum pad, piano or piano roll
- Building a synth, mixer, DAW, sampler, recorder or player interface
- Connecting controls to the Web Audio API, or displays to live audio
- Styling `@audio-ui/react` primitives with your own design system
- Building audio controls outside React (Vue, Svelte, Solid, Angular, web components, vanilla JS)
- Letting a chat, voice or agent compose, edit or mix through the interface
- Reviewing audio UI code for clicks, drift, re-renders or accessibility

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
| --- | --- | --- | --- |
| 1 | Web Audio | CRITICAL | `audio-` |
| 2 | Live Data | CRITICAL | `live-` |
| 3 | Values & Events | HIGH | `values-` |
| 4 | Accessibility | HIGH | `a11y-` |
| 5 | Without React | HIGH | `core-` |
| 6 | Styling | MEDIUM | `style-` |
| 7 | AI Control | MEDIUM | `ai-` |

## Quick Reference

### 1. Web Audio (CRITICAL)

- `audio-resume-in-gesture` - Create the AudioContext lazily on the client, resume it in the click that starts sound
- `audio-ramp-parameters` - `setTargetAtTime`, never `param.value =` from a drag
- `audio-schedule-on-audio-clock` - Start notes at an AudioContext time from a look-ahead clock, never from timers
- `audio-db-to-gain` - dB on the control, `10 ** (db / 20)` on the GainNode
- `audio-headroom` - Size voices, resonance and master volume so the loudest case stays under full scale
- `audio-cleanup` - Stop and disconnect nodes, cancel frames on unmount

### 2. Live Data (CRITICAL)

- `live-source-not-state` - Meters, traces, waveforms and playheads take a `source` (`createSource`), never per-frame state
- `live-meter-levels` - `use-audio-levels` for RMS in dB from time-domain samples, with peak hold
- `live-mic-input` - Raw microphone signal up-mixed to stereo, analysers never connected to the speakers
- `live-midi-input` - `use-midi-input` for the page's one MIDI input, connected from a click
- `live-pitch-detection` - A YIN period search (`use-pitch`) for a tuner, never the loudest FFT bin
- `live-playhead-source` - Playback position through a source updated every frame
- `live-decode-once` - Decode and reduce waveform peaks once per file
- `live-leaf-subscription` - Subscribe to a source only in the leaf that prints it
- `live-spectrum-hook` - `use-spectrum` for a log-axis spectrum on a Plot

### 3. Values & Events (HIGH)

- `values-controlled-or-uncontrolled` - `value` + `onValueChange`, or `defaultValue`, never both
- `values-commit-for-persistence` - Sound on `onValueChange`, saving and undo on `onValueCommitted`
- `values-step-fits-range` - Set `step` and `largeStep` to the range; the defaults (1 and 10) assume 0 to 100
- `values-log-scale-frequency` - `scale="log"` for frequency, Q and ratios
- `values-cancel-change` - Reject a change with `eventDetails.cancel()`
- `values-anchor-bipolar` - `anchor={0}` for pan and detune

### 4. Accessibility (HIGH)

- `a11y-accessible-name` - Every control has `aria-label` or its `Label` part
- `a11y-keep-focusable-part` - Restyle the thumb with `render`, never replace it
- `a11y-focus-and-hit-area` - Draw `:focus-visible`, widen small hit areas

### 5. Without React (HIGH)

- `core-one-controller` - Create one controller per control, once; never on every option change
- `core-redraw-after-set-options` - `setOptions` replaces everything and notifies no one: pass all options, then redraw
- `core-draw-from-snapshot` - Draw angle, percent and text from `getSnapshot()`, never recomputed
- `core-native-range-input` - A hidden `<input type="range">` wired to `keyDown` and `type`
- `core-pointer-handler` - Primary button, `preventDefault`, focus the input and `touch-action: none` before `press`
- `core-cleanup` - Call the removers `subscribe` and `attachWheel` return
- `core-public-entries` - `@audio-ui/core` and `@audio-ui/core/<name>`, never `/internal`

### 6. Styling (MEDIUM)

- `style-headless-state` - Style primitives by state: `className` functions, `data-*`, CSS variables
- `style-props-before-classname` - Registry components: `size`, `marks`, `orientation` before classes
- `style-semantic-tokens` - Theme tokens, never raw palette colors
- `style-never-edit-package` - Style the parts or copy the registry component, never patch the package

### 7. AI Control (MEDIUM)

- `ai-person-in-charge` - No tool records or plays on its own; bounded levels; undoable edits
- `ai-schema-from-instance` - Tool schemas built from this component's config
- `ai-tools-edit-state` - Tools return the next state; they never touch the DOM
- `ai-pure-reducers` - `apply` is pure and re-clamps the model's output
- `ai-current-state` - Give the model the state it edits
- `ai-structured-tool-calls` - Tool calls with validated arguments, never parsed prose

## Component Selection

| Need | Use |
| --- | --- |
| One continuous parameter (level, cutoff, pan) | `knob` (rotary) or `fader` (linear) |
| Two parameters on one surface | `xypad` |
| ADSR or any breakpoint shape | `envelope` |
| Level in dB with peak hold | `meter` |
| Audio file shape, seeking, live scope | `waveform` |
| EQ, filter or compressor curve with handles | `plot` |
| Live spectrum, frequency analyzer | `spectrum-analyzer` |
| Arrangement view, clips, ruler, playhead | `timeline` |
| Step pattern | `sequencer` |
| Drum pads, sample triggers | `pad` |
| Playable keyboard | `piano` |
| Play from a MIDI keyboard | `use-midi-input` hook, `midi-connect-control` |
| Tune an instrument, name the note of a sound | `tuner`, with `use-microphone` and `use-pitch` |
| Note editor | `piano-roll` |
| Play, stop, record, loop, bars and tempo | `transport` |
| Play and pause with a seek bar | `scrubber` |

Installed components import from `@/components/audio-ui/<name>`. Every import, install name and ready block: [components.md](./components.md).

## Workflow

1. **Read the project.** `package.json` (framework, and React 19 for the React layers), `components.json` if any, the lockfile for the package manager.
2. **Pick the layer and the component** from the two tables above.
3. **Read the component's docs before writing code**: `https://www.audio-ui.dev/llm/components/base/<name>` (markdown), or the MCP server ([setup.md](./setup.md)). Props are specific; a guessed prop compiles and misbehaves.
4. **Install, then import from where it landed.** Registry: `npx shadcn@latest add @audio-ui/<name>` (add the namespace once, [setup.md](./setup.md)) copies it to `components/audio-ui/<name>.tsx`: `import { Meter } from "@/components/audio-ui/meter"` (through the project's `components` alias). The CLI prints every file it writes: import from those paths, not from memory. React package: install `@audio-ui/react`, import from `@audio-ui/react/<name>`. Other frameworks: install `@audio-ui/core` and follow [core.md](./core.md).
5. **Write the code against the CRITICAL and HIGH rules** first.
6. **Verify.** Type check. Drag every control fast (no clicks in the sound), Tab to each control and use the arrow keys, background the tab during playback, and check nothing re-renders per frame.

## How to Use

Read the rule files for the explanation and the incorrect and correct code:

```
rules/audio-ramp-parameters.md
rules/live-source-not-state.md
```

- [components.md](./components.md): every component and block with its install name and import
- [setup.md](./setup.md): registry namespace, npm packages, MCP server
- [core.md](./core.md): the controllers outside React, with a plain DOM knob and Vue and Svelte bindings
- Full docs: https://www.audio-ui.dev/llms.txt

## Full Compiled Document

Every rule expanded in one file: [AGENTS.md](./AGENTS.md)
