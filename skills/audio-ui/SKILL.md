---
name: audio-ui
description: "Picks, installs and wires audio/ui components in React, with or without shadcn: chooses between the @audio-ui shadcn registry and the headless @audio-ui/react primitives, installs the right knob, fader, XY pad, envelope, level meter, waveform, EQ or filter plot, timeline, step sequencer, drum pad, piano, piano roll or transport bar, and sets how its value and events flow (controlled or uncontrolled, change versus commit, scales, anchors), keeps it accessible, styles it with the registry's props and tokens, and lets an AI model drive it through tools. Use for any request to add an audio control or display to a React app, to build a synth, mixer, DAW, sampler or player from those parts, or when a project imports @audio-ui/react or has an @audio-ui registry in components.json, even if the user does not name audio/ui. Sound and live signals are the web-audio skill, the look is the design skill, and non-React frameworks are the core skill."
license: MIT
metadata:
  author: audio/ui
  version: "1.2.0"
---

# audio/ui

Accessible, composable audio controls, in three layers:

| Layer | What it is | Pick it when |
| --- | --- | --- |
| `@audio-ui` registry (shadcn) | Styled components and blocks copied into the project | The project has a `components.json` (shadcn/ui, Tailwind v4) |
| `@audio-ui/react` (npm) | Headless React primitives: behavior, input handling and ARIA, no styles | React without shadcn, or the project brings its own design system. Ready skins: the `design` skill |
| `@audio-ui/core` (npm) | Framework-free controllers: value math, scales, pointer, wheel and keyboard handling, live sources | Vue, Svelte, Solid, Angular, web components or the plain DOM → the `core` skill |

Run commands with the project's package manager, read from its lockfile: `npx shadcn@latest`, `pnpm dlx shadcn@latest`, `bunx --bun shadcn@latest` or `yarn dlx shadcn@latest`. Examples use `npx`.

## The audio/ui skills

audio/ui ships as one plugin of four skills. Each one loads when its job comes up; use the neighbor for the rest.

| Skill | Job |
| --- | --- |
| `audio-ui` | Pick, install and wire the components: layers, component selection, values and events, accessibility, styling, AI control |
| `web-audio` | Sound and live data: the AudioContext, click-free ramps, scheduling, meters, spectra, playheads, microphone and MIDI input |
| `design` | How it looks: retro, minimal and modern skins, materials, and composing a look from a brief |
| `core` | Outside React: the framework-free controllers for Vue, Svelte, Solid, Angular, web components and the plain DOM |

## When to Apply

- Adding a knob, fader, XY pad, envelope, meter, waveform, plot, timeline, sequencer, drum pad, piano or piano roll
- Building a synth, mixer, DAW, sampler, recorder or player interface
- Choosing between the registry, the headless package and the framework-free controllers
- Making a control controlled, deciding what happens on change and on commit, or keeping it usable with a keyboard and a screen reader
- Styling `@audio-ui/react` primitives with your own design system
- Letting a chat, voice or agent compose, edit or mix through the interface

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
| --- | --- | --- | --- |
| 1 | Values & Events | HIGH | `values-` |
| 2 | Accessibility | HIGH | `a11y-` |
| 3 | Styling | MEDIUM | `style-` |
| 4 | AI Control | MEDIUM | `ai-` |

The CRITICAL rules (sound without clicks, live data without re-renders) are in the `web-audio` skill: read them before writing any code that makes or measures sound.

## Quick Reference

### 1. Values & Events (HIGH)

- `values-controlled-or-uncontrolled` - `value` + `onValueChange`, or `defaultValue`, never both
- `values-commit-for-persistence` - Sound on `onValueChange`, saving and undo on `onValueCommitted`
- `values-step-fits-range` - Set `step` and `largeStep` to the range; the defaults (1 and 10) assume 0 to 100
- `values-log-scale-frequency` - `scale="log"` for frequency, Q and ratios
- `values-cancel-change` - Reject a change with `eventDetails.cancel()`
- `values-anchor-bipolar` - `anchor={0}` for pan and detune
- `values-editable-readout` - `editable` on `Knob.Value` and `Fader.Value` lets people type an exact number
- `values-knob-drag-mode` - `dragMode="vertical"` on knobs: up and down, not around the dial

### 2. Accessibility (HIGH)

- `a11y-accessible-name` - Every control has `aria-label` or its `Label` part
- `a11y-keep-focusable-part` - Restyle the thumb with `render`, never replace it
- `a11y-live-readout` - Silent display, a polite status that changes only when the meaning does
- `a11y-focus-and-hit-area` - Draw `:focus-visible`, widen small hit areas

### 3. Styling (MEDIUM)

- `style-headless-state` - Style primitives by state: `className` functions, `data-*`, CSS variables
- `style-props-before-classname` - Registry components: `size`, `marks`, `orientation` before classes
- `style-semantic-tokens` - Theme tokens, never raw palette colors
- `style-never-edit-package` - Style the parts or copy the registry component, never patch the package

### 4. AI Control (MEDIUM)

- `ai-person-in-charge` - No tool records or plays on its own; bounded levels; undoable edits
- `ai-schema-from-instance` - Tool schemas built from this component's config
- `ai-tools-edit-state` - Tools return the next state; they never touch the DOM
- `ai-pure-reducers` - `apply` is pure and re-clamps the model's output
- `ai-current-state` - Give the model the state it edits
- `ai-structured-tool-calls` - Tool calls with validated arguments, never parsed prose
- `ai-device-contract` - A device is a state and a description (`defineDevice`), with a controlled panel, an engine and tools, not a widget with audio inside

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
| A compressor, or any effect, as a state a host and an agent can drive | `block-compressor`, `block-equalizer`, `block-delay`, `block-reverb`, `block-filter`, `block-distortion`, `block-chorus`, or `defineDevice` and `device-panel` |
| Tune an instrument, name the note of a sound | `tuner`, with `use-microphone` and `use-pitch` |
| Note editor | `piano-roll` |
| A note editor's menus: scale, find, edit commands, MIDI files | `scale-menu`, `note-find`, `note-edit-menu`, `midi-file` |
| Play a piano roll's notes, with undo and redo | `use-piano-roll-playback`, `use-undo-history` |
| Play, stop, record, loop, bars and tempo | `transport` |
| Play and pause with a seek bar | `scrubber` |

Installed components import from `@/components/audio-ui/<name>`. Every import, install name and ready block: [components.md](./components.md).

## Workflow

1. **Read the project.** `package.json` (framework, and React 19 for the React layers), `components.json` if any, the lockfile for the package manager.
2. **Pick the layer and the component** from the two tables above. No `components.json`, or the user wants a distinct look (retro, minimalist, modern): use `@audio-ui/react` with the kit of the `design` skill, never a hand-written slider.
2b. **Choose a visual direction** and say it in one sentence (retro hardware, minimal or modern), then follow the `design` skill: it has the skins, the `Panel` markup, and how to compose a look from a brief. Outside React, the `core` skill has the plain DOM kit.
3. **Read the component's docs before writing code**: `https://www.audio-ui.dev/llm/components/base/<name>` (markdown), or the MCP server ([setup.md](./setup.md)). Props are specific; a guessed prop compiles and misbehaves. Offline, the verified `Panel` markup and the props table of the `design` skill's `directions.md` cover knob, fader, meter, XY pad, pad and piano; the entries are `@audio-ui/react/knob`, `fader`, `meter`, `xypad`, `pad`, `piano`.
4. **Install, then import from where it landed.** Registry: `npx shadcn@latest add @audio-ui/<name>` (add the namespace once, [setup.md](./setup.md)) copies it to `components/audio-ui/<name>.tsx`: `import { Meter } from "@/components/audio-ui/meter"` (through the project's `components` alias). The CLI prints every file it writes: import from those paths, not from memory. React package: install `@audio-ui/react`, import from `@audio-ui/react/<name>`. Other frameworks: install `@audio-ui/core` and use the `core` skill.
5. **Write the code against the CRITICAL and HIGH rules** first, starting with the `web-audio` skill for anything that makes or measures sound.
6. **Verify.** Type check, render the page and look at a screenshot. A headless browser has no microphone: feed an `OscillatorNode` through the same analyser to test an input path. Drag every control fast (no clicks in the sound), Tab to each control and use the arrow keys, background the tab during playback, and check nothing re-renders per frame.

## How to Use

Read the rule files for the explanation and the incorrect and correct code:

```
rules/values-commit-for-persistence.md
rules/a11y-accessible-name.md
```

- [components.md](./components.md): every component and block with its install name and import
- [setup.md](./setup.md): registry namespace, npm packages, MCP server
- Full docs: https://www.audio-ui.dev/llms.txt

## Full Compiled Document

Every rule of this skill expanded in one file: [AGENTS.md](./AGENTS.md)
