---
name: change-primitive
description: "Change, fix or add a headless primitive or its logic: the behavior of a primitive and its adapters in the registry (React, Vue, Svelte, web), or the engine's modules (registry/bases/shared/lib/engine): props, parts, keyboard or pointer behavior, ARIA, scales, timeline or waveform math. Use for any edit under registry/bases/shared/primitives/ or lib/engine/, since each one needs tests and the matching docs."
---

# Change a primitive

The primitives, their adapters and the engine's modules are not packages: they are registry files that people copy, and a change reaches a project only when it installs the item again. A file a project already holds keeps its version until then, so break nothing a released file exports.

## Where the code goes

- **The behavior of a primitive** (its value, gestures, keys, attributes, events and state, once for every framework): `apps/www/src/registry/bases/shared/primitives/<name>/<name>.ts`, written on the UI SDK kernel over `primitive.ts`, with the files it reads beside it (`piano-roll/edits.ts`, `timeline/clip.ts`…). A file several primitives share (`primitive.ts`, `grid.ts`, `frame.ts`, `pitch.ts`) only gains exports: `test/shared-files.test.ts` checks it.
- **The adapters**: `primitives/<name>/` beside it (a folder for each framework: `react/`, `vue/`, `svelte/`, `web/`, each with its `index`), declared in `primitives/_registry.ts`. Each is thin: parts and what only its framework needs (a provider, an editable readout).
- **Audio logic** (devices, time, analysis, MIDI, scales, playback), and anything built on an audio.js atom: `apps/www/src/registry/bases/shared/lib/engine/<module>/`, one item per module (`engine-<module>`), listed in `registry/bases/modules.ts` (`test/lib-modules.test.ts` checks it); the GPU drawing is the same, `lib/gl/<module>/` as `gl-<module>`. The registry's files import a module as `@/engine/<module>`; its own files import each other by relative path, with no extension.

## Rules

- Relative imports have no extension (`./controller`): the files land in projects that may not allow `.ts` imports.
- Keep the domain words of [CONTEXT.md](../../../CONTEXT.md): `onValueChange` streams every change, `onValueCommitted` fires once when the gesture ends.
- Accessibility is part of the behavior: every interactive part keeps a role, an accessible name hook (`aria-label` or a `Label` part), keyboard support and `aria-valuetext` where a value is shown.
- Public API: removing or renaming a prop, part or export is a breaking change. Prefer adding. If you must break, say so in the changeset and ask first.

## Steps

1. **Test first.** Reproduce the bug or describe the new behavior in a test. A scenario of a primitive's behavior is written once, in `apps/www/test/primitives/`, and runs against the adapters of React, Vue, Svelte and the web (`bun run test:primitives` in `apps/www`).
2. **Change the code**: the primitive first, then the adapters. A file the worklet bundles (`lib/engine/playback/`) needs `bun run engine:worklet` in `apps/www` afterwards, and a kernel added or bumped `bun run engine:kernels`.
3. **Docs.** The primitive's docs are the "Headless primitive" section of the component's page, `apps/www/src/content/docs/components/base/(elements|workstation)/<name>.mdx` (the timeline's is `arrangement.mdx`): its install in each framework, options, parts and what a change reports. A change to an engine module also shows on its page, `apps/www/src/content/docs/engine/<module>.mdx`: its head (exports and their JSDoc's first sentence, sources) is generated, so run `bun run registry:build` in `apps/www` (`test/entries.test.ts` and `test/package-modules-docs.test.ts` fail on a page that lags).
4. **Shipped skill.** If a prop, part, data attribute or CSS variable that `skills/audio-ui/` names changed, update it; `bun test test/skills.test.ts` in `apps/www` checks the names.
5. **Registry element.** If the styled element in `apps/www/src/registry/bases/shared/audio-ui/elements/<name>.tsx` should use the new prop or part, update it and follow the `add-registry-item` skill's build step.
6. **Check like CI** (from the repo root):
   ```sh
   bun run lint:fix
   bunx biome ci apps/www/src/registry/bases/shared/lib/engine
   (cd apps/www && bun run typecheck && bun test && bun run test:primitives)
   ```
7. **Look at it.** Run `bun run dev`, open the primitive's docs page on `localhost:4000`, and drive it with the pointer, the wheel and the keyboard.

If the change is visible, film it: `film-component` skill, `bun run update <name>`.
