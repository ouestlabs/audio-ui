---
name: core
description: "Load this before writing any audio control, knob, fader, meter, XY pad or slider for Vue, Svelte, Solid, Angular, Lit, web components or plain JavaScript and the DOM, or in any project without React. It holds the framework-free @audio-ui/core controllers behind every audio/ui primitive (value math, log scales, pointer, wheel and keyboard handling, native range input for accessibility, live sources), the plain DOM knob and fader, and the Vue and Svelte bindings, so the control is not rewritten from scratch. Use it whenever the user names a non-React framework or says no React, even if they only ask for a rotary knob, a fader or a synth UI."
license: MIT
metadata:
  author: audio/ui
  version: "1.2.0"
---

# Audio controls without React

`@audio-ui/core` holds the logic of every audio/ui primitive with no framework in it: value math, scales, pointer, wheel and keyboard handling, and live sources. A control outside React is one controller, a native range input for accessibility, and a few lines of drawing.

## When to Apply

- Audio controls for Vue, Svelte, Solid, Angular, web components or the plain DOM
- A project that has no React, or no `@audio-ui/react`
- Writing a binding of the controllers for another framework
- Reviewing code that creates controllers, subscribes or redraws

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
| --- | --- | --- | --- |
| 1 | Without React | HIGH | `core-` |

## Quick Reference

### 1. Without React (HIGH)

- `core-one-controller` - Create one controller per control, once; never on every option change
- `core-redraw-after-set-options` - `setOptions` replaces everything and notifies no one: pass all options, then redraw
- `core-draw-from-snapshot` - Draw angle, percent and text from `getSnapshot()`, never recomputed
- `core-native-range-input` - A hidden `<input type="range">` wired to `keyDown` and `type`
- `core-pointer-handler` - Primary button, `preventDefault`, focus the input and `touch-action: none` before `press`
- `core-cleanup` - Call the removers `subscribe` and `attachWheel` return
- `core-public-entries` - `@audio-ui/core` and `@audio-ui/core/<name>`, never `/internal`

## Workflow

1. **Install** `@audio-ui/core` (no dependencies) and read [core.md](./core.md): the entries, a plain DOM knob, and Vue and Svelte bindings.
2. **Create one controller per control**, once (`core-one-controller`), wire a hidden `<input type="range">` to it (`core-native-range-input`), and draw from `getSnapshot()` (`core-draw-from-snapshot`).
3. **Handle the pointer the way the rules say** (`core-pointer-handler`) and call the removers on teardown (`core-cleanup`).
4. **Look.** The `design` skill has the skins and `styles/dom.css` for the plain DOM; sound and live data come from the `web-audio` skill.
5. **Verify.** Tab to each control and use the arrow keys, then drag it fast.

## How to Use

Read the rule files for the explanation and the incorrect and correct code:

```
rules/core-one-controller.md
rules/core-cleanup.md
```

- [core.md](./core.md): the controllers outside React, with a plain DOM knob and Vue and Svelte bindings
- Full docs: https://www.audio-ui.dev/llms.txt

## Full Compiled Document

Every rule of this skill expanded in one file: [AGENTS.md](./AGENTS.md)
