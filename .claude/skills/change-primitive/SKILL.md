---
name: change-primitive
description: "Change, fix or add a headless primitive or its logic: the behavior of a primitive and its adapters in the registry (React, Vue, Svelte, web), or the published package @audio-ui/engine (packages/engine): props, parts, keyboard or pointer behavior, ARIA, scales, timeline or waveform math. Use for any edit under registry-audio/bases/base/primitives/ or packages/, since each one needs tests, a changeset where it is published, and the matching docs."
---

# Change a primitive

`@audio-ui/engine` is published to npm: every change there is a change to someone's app. The primitives are not a package: they and their adapters are registry files that people copy, and a change there reaches a project only when it installs the item again.

## Where the code goes

- **The behavior of a primitive** (its value, gestures, keys, attributes, events and state, once for every framework): `apps/www/src/registry-audio/bases/base/primitives/<name>/<name>.ts`, written on the UI SDK kernel over `primitive.ts`, with the files it reads beside it (`piano-roll/edits.ts`, `timeline/clip.ts`…). A file several primitives share (`primitive.ts`, `grid.ts`, `frame.ts`, `pitch.ts`) only gains exports: `test/shared-files.test.ts` checks it.
- **The adapters**: `primitives/<name>/` beside it (a folder for each framework: `react/`, `vue/`, `svelte/`, `web/`, each with its `index`), declared in `primitives/_registry.ts`. Each is thin: parts and what only its framework needs (a provider, an editable readout).
- **Audio logic** (devices, time, analysis, MIDI, scales, playback), and anything built on an audio.js atom: `packages/engine/src/<module>/`.

## Rules

- Relative imports end in `.ts` / `.tsx` (`./controller.ts`). A `.js` specifier breaks the www build.
- Keep the domain words of [CONTEXT.md](../../../CONTEXT.md): `onValueChange` streams every change, `onValueCommitted` fires once when the gesture ends.
- Accessibility is part of the behavior: every interactive part keeps a role, an accessible name hook (`aria-label` or a `Label` part), keyboard support and `aria-valuetext` where a value is shown.
- Public API: removing or renaming a prop, part or export is a breaking change. Prefer adding. If you must break, say so in the changeset and ask first.

## Steps

1. **Test first.** Reproduce the bug or describe the new behavior in a test. A scenario of a primitive's behavior is written once, in `apps/www/test/primitives/`, and runs against the adapters of React, Vue, Svelte and the web (`bun run test:primitives` in `apps/www`).
2. **Change the code**: the primitive first, then the adapters.
3. **Docs.** The primitive's docs are the "Headless primitive" section of the component's page, `apps/www/src/content/docs/components/base/(elements|workstation)/<name>.mdx` (the timeline's is `arrangement.mdx`): its install in each framework, options, parts and what a change reports. A change to `@audio-ui/engine` also shows on its module's page, `apps/www/src/content/docs/engine/<module>.mdx`: its head (exports and their JSDoc's first sentence, sources) is generated, so run `bun run registry:build` in `apps/www` (`test/entries.test.ts` and `test/package-modules-docs.test.ts` fail on a page that lags).
4. **Shipped skill.** If a prop, part, data attribute or CSS variable that `skills/audio-ui/` names changed, update it; `bun test test/skills.test.ts` in `apps/www` checks the names.
5. **Registry element.** If the styled element in `apps/www/src/registry-audio/bases/base/audio/elements/<name>.tsx` should use the new prop or part, update it and follow the `add-registry-item` skill's build step.
6. **Changeset**, for `@audio-ui/engine` (a primitive has none: it ships as registry files; a change to a web adapter raises `apps/www/src/registry-audio/web-version.json`). `bun run changeset`, or write `.changeset/<short-name>.md` by hand:
   ```md
   ---
   "@audio-ui/engine": patch
   ---

   Playback: <what changed for the user, and why, in one or two sentences>.
   ```
   `patch` for fixes, `minor` for new props or parts, `major` only for breaks. Start with the component name. No em dashes, and don't name the underlying headless library.
7. **Check like CI** (from the repo root):
   ```sh
   bun run lint:fix
   bunx biome ci packages/engine packages/gl
   bun run build:pkg
   (cd packages/engine && bunx tsc --noEmit && bun test)
   (cd apps/www && bun run typecheck && bun test && bun run test:primitives)
   ```
8. **Look at it.** Run `bun run dev`, open the primitive's docs page on `localhost:4000`, and drive it with the pointer, the wheel and the keyboard.

If the change is visible, film it: `film-component` skill, `bun run update <name>`.
