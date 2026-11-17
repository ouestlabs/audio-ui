# Core, engine and gl: depend or copy

Context (2026-11-17). The docs have no "Core" section any more: the pages of `core/`, `engine/` and `gl/` sit under Components. The question for the next session is whether `@audio-ui/core`, `@audio-ui/engine` and `@audio-ui/gl` stay published packages that registry items depend on, or become files a user copies.

## What holds today

- A registry item declares npm dependencies, so `npx shadcn@latest add @audio-ui/knob` already installs `@audio-ui/core` for the user: one command, no setup.
- The DAW, the lab and the video depend on engine. Copying the logic into each would duplicate it with no shared updates.
- engine wraps the audio.js atoms and holds generated files (worklet source, kernels) that a test keeps in sync. The rule "a registry file never imports an `@audio/*` atom" exists so a user is not tied to them. Copying engine into a project breaks it.

## Proposal

1. Try it on `gl`, the smallest and most isolated: make it registry items (files with their own dependencies on `gl-waveform` and `gl-spectrogram`), and see what the user gets, what breaks, and how an update reaches them.
2. From that, decide for `core`. Its logic is zero-dependency, so copying it is plausible, but every primitive imports it: measure how many files a single `knob` would bring.
3. Leave `engine` for last, and probably as a dependency, for the reasons above.

## To check first

- How many files and lines a primitive would copy with its core logic, for the largest (timeline, piano roll) and the smallest (knob).
- How a fix in copied logic reaches users who copied it (the shadcn model has no update path: say so in the docs, or provide a `diff` flow).
- What the agents (skill, MCP) tell an agent to import, and whether it changes.
