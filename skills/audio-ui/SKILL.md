---
name: audio-ui
description: Build audio interfaces in React with audio/ui (@audio-ui/react, https://audio-ui.xyz). Use this skill whenever the user wants a knob, fader, XY pad, envelope editor, level meter, waveform, EQ or filter plot, timeline, step sequencer, piano keyboard, piano roll, transport bar or scrubber, or any synth, mixer, DAW, sampler or audio player UI in React or Next.js, even if they do not name audio/ui. Also use it when the project has an `@audio` registry in components.json or imports `@audio-ui/react`.
---

# audio/ui

audio/ui gives React apps accessible, composable audio controls in two layers. Pick the layer first, because it decides every command that follows.

| Layer | What it is | Pick it when |
| --- | --- | --- |
| `@audio-ui/react` (npm) | Headless primitives: behavior, pointer/wheel/keyboard handling and ARIA, no styles | The user has their own design system or wants full control of the look |
| `@audio` registry (shadcn) | Styled components and ready blocks that wrap the primitives, copied into the project | The project uses shadcn/ui and Tailwind v4, and the user wants something that looks right at once |

If the project has a `components.json`, default to the registry. Otherwise install the package.

## Workflow

1. **Look at the project.** Read `package.json` and `components.json` (React 19 and Tailwind v4 are required for the registry). Note the package manager from the lockfile and use it for every command.
2. **Find the right component.** Use the audio/ui MCP server if it is connected (`list_components`, `search_catalog`, `get_component_docs`), otherwise read `references/components.md`. Do not guess prop names: each component's props live in its docs page, and a wrong guess compiles but misbehaves.
3. **Read the docs page before writing code.** Fetch `https://audio-ui.xyz/docs/components/base/<name>` with a markdown `Accept` header, or `/llm/components/base/<name>`. It holds the install command, the API and a copyable example.
4. **Install.** Registry: `npx shadcn@latest add @audio/<name>` (add the namespace once, see `references/setup.md`). Package: `npm install @audio-ui/react`. Use the project's own package manager runner.
5. **Wire it to audio.** Controls only emit values. The audio side (a Web Audio `AudioParam`, an app store) is the project's job. Set a parameter with `param.setTargetAtTime(value, ctx.currentTime, 0.01)` instead of assigning `.value`, so dragging never clicks.
6. **Check it.** Run the type check and look at the page. Tab to each control and use arrow keys: if it does not respond, the accessible name or the value binding is missing.

## Things that are easy to get wrong

- **Controlled vs uncontrolled.** Components accept `value` with `onValueChange`, or `defaultValue` alone. Mixing both makes the control jump or freeze. Choose one.
- **Accessible names.** Every control needs `aria-label` or a visible label tied to it. A knob without a name is unusable with a screen reader.
- **Live data stays out of React state.** Playheads, meters and waveforms that follow a signal take a source or ref, not a `setState` per frame, which would re-render the page 60 times a second. See the `Meter` and `Timeline` docs for the source pattern.
- **Semantic tokens only.** In registry components use `bg-primary`, `text-muted-foreground` and the like, never raw palette colors, so the theme and dark mode keep working.
- **Client components.** Anything that uses hooks or the browser needs `"use client"` in Next.js.
- **Do not edit `@audio-ui/react`.** Adapt the copied registry component instead, it belongs to the project.

## Reference files

- `references/components.md`: every component with its install command, import and when to use it.
- `references/setup.md`: adding the registry, installing the package, connecting the MCP server.

When something is not covered here, the full docs are at https://audio-ui.xyz/llms.txt.
