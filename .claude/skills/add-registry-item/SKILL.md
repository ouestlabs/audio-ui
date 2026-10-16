---
name: add-registry-item
description: Add, change, rename or remove an item of the audio/ui shadcn registry in apps/www/src/registry-audio (a block, a demo, a styled element over a primitive, a hook or a lib), and wire it into _registry.ts, categories, the generated manifests and the docs. Use for any work under registry-audio/, even a one-line change to a block, because the generated JSON goes stale otherwise.
---

# Add or change a registry item

All paths below are under `apps/www/src/registry-audio/bases/base/` unless they start with `apps/`. The rules for file names, exports, icons and colors are in `AGENTS.md` ("Registry items"); [CONTRIBUTING.md](../../../CONTRIBUTING.md) has the long version with a full `_registry.ts` example.

## 1. Pick the place and the type

| You are adding | File | `_registry.ts` | Item `type` |
| --- | --- | --- | --- |
| A styled element over a primitive | `audio/elements/<name>.tsx` | `audio/_registry.ts` | `registry:ui` |
| The face of a device (controlled, no audio) | `audio/panels/<name>-panel.tsx` | `audio/_registry.ts` | `registry:ui` |
| A composed screen | `components/<category>/block-<component>-<variant>.tsx` | `components/_registry.ts` | `registry:block` |
| A focused example for the docs | `components/<category>/<component>-<feature>-demo.tsx` | `components/_registry.ts` | `registry:example` |
| A hook | `hooks/use-<name>.ts` | `hooks/_registry.ts` | `registry:hook` |
| Framework-free logic | `lib/<name>.ts` | `lib/_registry.ts` | `registry:lib` |

Before writing, open the closest existing item of the same kind and copy its shape. The catalog is deliberately small: prefer extending an existing block or demo over adding a near-duplicate, and ask before adding a new block.

## 2. Write it

- Elements add appearance only. Behavior (pointer, keyboard, ARIA, value logic) belongs in the primitive: if you need new behavior, switch to the `change-primitive` skill.
- Import audio elements from `@/registry-audio/bases/base/audio/elements/...` and shadcn parts from `@/registry/bases/base/ui/...`.
- Live signals (playheads, meters, spectra) go through a source or a ref, never a `setState` per frame.
- Set a Web Audio parameter with `setTargetAtTime`, not `.value =`, so a drag never clicks.
- A hook or lib stays free of app imports (`@/app/...`), since it is copied into other projects.

## 3. Register it

Add the entry to the matching `_registry.ts`:

- `name` is the install name (`npx shadcn add @audio-ui/<name>`), usually the file name without extension
- `files[].path` is relative to `bases/base/`
- `registryDependencies`: `"@audio-ui/<name>"` for our items, `"@shadcn/<name>"` for shadcn's
- `dependencies`: the npm packages the file imports (`"@audio-ui/react"`, `"zod"`)
- `categories` (blocks and demos): the category folder at least. A new category also goes in `bases/categories.ts` (label + description); a category with no items fails the build.

Renaming or removing an item: also search for its old name in `apps/www/src/content/docs`, `skills/audio-ui/` and `apps/video/src/showcases`, since docs install commands and the shipped skill name items directly (`bun test test/skills.test.ts` catches the skill).

## 4. Docs

- A demo appears in a docs page through `<ComponentPreview styleName="base-nova" name="<demo-name>" />`.
- In docs, an installed component is imported as `@/components/audio-ui/<name>` (where the registry puts it), and its source titled `components/audio-ui/<name>.tsx`. `bun test test/install-paths.test.ts` checks every such import.
- A new component page: `apps/www/src/content/docs/components/base/<name>.mdx`, copying the sections of `knob.mdx` (Overview, Installation, Anatomy, Usage, Interaction, API reference); list it in that folder's `meta.json`, add the slug to `CANONICAL_COMPONENT_DOC_SLUGS` in `apps/www/src/lib/seo.ts`, and add it to `skills/audio-ui/components.md` (and the Component Selection table in `skills/audio-ui/SKILL.md`).

## 5. Build and check (from `apps/www/`)

```sh
bun run lint:fix          # first: it reformats the sources
bun run registry:build    # then: regenerates public/r/ and the manifests from the formatted sources
bun run icons:build       # only if you added an icon name
bun run typecheck
bun test
```

Run `registry:build` **after** the last lint fix, or the generated JSON lags the source. Commit the regenerated files with the change.

Then open the page on `localhost:4000` (the catalog `/components` and the docs page), use the item with the pointer and the keyboard, and check both themes.
