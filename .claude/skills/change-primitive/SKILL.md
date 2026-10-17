---
name: change-primitive
description: "Change, fix or add a headless primitive or its logic in the published packages @audio-ui/react (packages/ui) or @audio-ui/core (packages/core): props, parts, keyboard or pointer behavior, ARIA, scales, timeline or waveform math. Use for any edit under packages/, since each one needs tests, a changeset and the matching docs API reference."
---

# Change a primitive

Both packages are published to npm. Every change here is a change to someone's app.

## Where the code goes

- **Logic that doesn't need React** (geometry, value mapping, clip operations, peaks): `packages/core/src/primitives/<name>/`, with a `*.test.ts` next to it. Shared helpers: `packages/core/src/{shared,value,dom}/`.
- **React parts**: `packages/ui/src/primitives/<name>/elements/<part>.tsx`, the context in `context.ts`, tests in `test/`. The public surface is `packages/ui/src/entries/<name>.ts`, re-exported by `index.ts`.
- A new export from core that adapters need but users don't goes in `packages/core/src/internal.ts`, not `index.ts`.

## Rules

- Relative imports end in `.ts` / `.tsx` (`./controller.ts`). A `.js` specifier breaks the www build.
- Keep the domain words of [CONTEXT.md](../../../CONTEXT.md): `onValueChange` streams every change, `onValueCommitted` fires once when the gesture ends.
- Accessibility is part of the behavior: every interactive part keeps a role, an accessible name hook (`aria-label` or a `Label` part), keyboard support and `aria-valuetext` where a value is shown.
- Public API: removing or renaming a prop, part or export is a breaking change. Prefer adding. If you must break, say so in the changeset and ask first.

## Steps

1. **Test first.** Reproduce the bug or describe the new behavior in a test (`bun test` in the package). Pointer and keyboard tests for parts live in `packages/ui/src/primitives/<name>/test/`.
2. **Change the code** in core first if the logic is framework-free, then the React part.
3. **Docs API reference.** The JSDoc of each part in `elements/` and the `<TypeRow>` lines under "API reference" in `apps/www/src/content/docs/components/base/(<space>)/<name>.mdx` are hand-kept copies of each other. Change both, word for word.
4. **Shipped skill.** If a prop, part, data attribute or CSS variable that `skills/audio-ui/` names changed, update it; `bun test test/skills.test.ts` in `apps/www` checks the names.
5. **Registry element.** If the styled element in `apps/www/src/registry-audio/bases/base/audio/elements/<name>.tsx` should use the new prop or part, update it and follow the `add-registry-item` skill's build step.
6. **Changeset.** `bun run changeset`, or write `.changeset/<short-name>.md` by hand:
   ```md
   ---
   "@audio-ui/react": patch
   ---

   Timeline: <what changed for the user, and why, in one or two sentences>.
   ```
   `patch` for fixes, `minor` for new props or parts, `major` only for breaks. Start with the component name. No em dashes, and don't name the underlying headless library.
7. **Check like CI** (from the repo root):
   ```sh
   bun run lint:fix
   bunx biome ci packages/core packages/ui
   bun run build:pkg
   (cd packages/core && bunx tsc --noEmit && bun test)
   (cd packages/ui && bunx tsc --noEmit && bun test && bun run size)
   ```
   `bun run size` enforces bundle budgets per entry. If it fails, look for an import that pulls in more than the primitive needs.
8. **Look at it.** Run `bun run dev`, open the component's docs page on `localhost:4000`, and drive it with the pointer, the wheel and the keyboard.

If the change is visible, film it: `film-component` skill, `bun run update <name>`.
