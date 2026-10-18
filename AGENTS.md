# audio/ui

**audio/ui** is an open-source library of accessible, composable Audio UI components for React: headless primitives published to npm, plus a shadcn registry of styled components built on them, designed to be copied, pasted, and owned.

- Site: https://www.audio-ui.dev · Repo: https://github.com/ouestlabs/audio-ui
- Registry endpoint: `https://www.audio-ui.dev/r/{style}/{name}.json`
- Domain language (Parameter, Commit, Primitive, Element, TransportClock…): [CONTEXT.md](CONTEXT.md). Use these words in code, docs and replies.
- Contribution guide with the full registry walkthrough: [CONTRIBUTING.md](CONTRIBUTING.md)

This file is the single source of instructions for every coding agent (Claude Code loads it through `.claude/CLAUDE.md`; Codex, Cursor, Copilot, Gemini, Zed and others read it directly).

---

## Monorepo

Turborepo + Bun workspaces. **Always use `bun` / `bunx`, never `npm`, `npx` or `pnpm`.**

```
audio-ui/
├── apps/
│   ├── www/        # TanStack Start docs site + registry (Fumadocs + MDX, prerendered, Cloudflare) → localhost:4000
│   └── video/      # Remotion videos of the real components (see apps/video/README.md)
├── packages/
│   ├── core/       # @audio-ui/core, published (framework-agnostic logic)
│   ├── ui/         # @audio-ui/react, published (headless primitives)
│   └── icons/      # @audio-ui/icons, published: audio glyphs (one thin stroke on a 24 grid, in four weights)
└── skills/audio-ui # The agent skill we ship to library users (npx skills add ouestlabs/audio-ui)
```

## Commands

```sh
bun run dev             # Start all apps
bun run build:pkg       # Build @audio-ui/core + @audio-ui/react (what gets published)
bun run lint:fix        # Auto-fix with Biome
bun run changeset       # Describe a change to a published package
```

From `apps/www/`:

```sh
bun run registry:build  # Regenerate registry JSON + site manifests, after any registry change
bun run icons:build     # Regenerate icon mappings, after adding icons
bun run typecheck
bun test
```

## Where things live

### `@audio-ui/core` (`packages/core/src/`)

- `shared/`: lang (types, guards), math, pitch
- `value/`: scales, ranges, formatting, change/commit event details, live sources and stores
- `dom/`: frame scheduling, pointer release, visibility, data attributes
- `primitives/<name>/`: each primitive's own logic (timeline clips, waveform peaks, envelope geometry…), published as `@audio-ui/core/<name>`
- `index.ts` is the public API; `internal.ts` (`@audio-ui/core/internal`) is for adapters only

`@audio-ui/react` depends on it. In development it resolves to `packages/core/src` through tsconfig `paths` (Bun honours them in tests); its build reads `dist`.

### `@audio-ui/react` (`packages/ui/src/`)

- `primitives/<name>/`: Envelope, Fader, Knob, Meter, Pad, Piano, PianoRoll, Plot, Sequencer, Timeline, Waveform, XYPad. Unstyled, accessible, compound parts in `elements/`
- `entries/<name>.ts`: one entry per primitive (also a subpath export, `@audio-ui/react/knob`); `index.ts` re-exports them

Published to npm: **don't break its public API without a changeset**.

### `apps/www/src/`: two registry trees

- `registry/`: design system started as a fork of shadcn/ui (bases, styles, icons, fonts, themes), now audio/ui's own. Edit it freely. `bun run registry:sync` pulls shadcn upstream and brings back what was removed, so only run it on purpose.
- `registry-audio/`: audio/ui's own registry, **the contribution surface**:

```
registry-audio/bases/base/
├── audio/elements/  # Styled elements over each primitive (knob.tsx, fader.tsx, timeline.tsx…)
├── audio/panels/    # The face of a device: controlled, no audio (compressor-panel.tsx…)
├── components/      # Catalog by category folder: block-{component}-{variant}.tsx + {component}-*-demo.tsx
├── hooks/           # use-web-audio, use-transport-clock, use-spectrum…
└── lib/             # web-audio, musical-time, waveform-dsp, lookahead-scheduler…
```

Each of `audio/`, `components/`, `hooks/`, `lib/` has an `_registry.ts`: **update the matching one when adding anything**. File paths inside are relative to `bases/base/`.

`registry-audio/bases/{components,registry,seo}.json` are **generated** by `registry:build` from the `_registry.ts` files and `registry-audio/bases/categories.ts`: never edit them by hand. A new category goes in `categories.ts`; a category with zero items fails the build. Item tags not listed there (`ui`, `grid`) are free-form search tags.

### The site's own code (`apps/www/src/components/`, `lib/`)

Grouped by what it does for the reader of the docs, two levels deep, so no folder holds a long flat list:

- `components/site/`: the chrome (`layout`, `navigation`, `home`, `pages`, `providers`). `docs/`: the docs page and what its MDX renders (`page`, `mdx`, `catalog`). `preview/`: what shows a component (`component`, `frame`, `controls`). `code/`: what shows its code (`source`, `block`, `copy`). `catalog/` and `customizer/`: the components catalog and the design-system customizer.
- `components/ui/` is the shadcn UI, left as it comes from shadcn and synced from it: never move or reorganize it, and keep the site's own components out of it. `icon-placeholder.tsx` stays at the root of `components/`: its path is the contract with the shadcn CLI.
- `lib/` follows the same idea: `docs/` (`content`, `menu`), `registry/` (`core`, `catalog`), `agents/` (MCP, llms), `seo/`, `code/`, `design-system/`.

### Docs (`apps/www/src/content/docs/`)

MDX under `(root)/` (the Get started guides) and `components/base/`. Use the existing components (`<ComponentPreview>`, `<ComponentSource>`, `<Install>`, `<Steps>`), not raw HTML. A component page's Installation section is one `<Install name="knob" packages="@audio-ui/react class-variance-authority" />` (or `kind="device"` for a device, whose Panel section shows `<DeviceUsage name="<slug>" />`), drawn from `lib/docs/content/install-docs.ts`; only a page whose installation differs, such as the timeline's, writes its own `<CodeTabs>`.

The docs, the catalog's `categoryGroups` and the shipped skill share one map, by what the reader builds. Each space is a folder of `components/base/` (the parentheses keep it out of the URL, so a page stays `/docs/components/base/<name>`), with its sections in its `meta.json`:

- `(elements)/`: the pieces of any audio interface. Controls, keyboards and pads, displays.
- `(workstation)/`: the surfaces of a DAW. Arrangement, editors, the piano roll's tools, transport and mixing.
- `(devices)/`: effects and instruments, like plugins. One page per device, by family.
- `engine/` (beside `components/`, at `/docs/engine/<page>`): what makes the sound, the hooks and libs that serve several spaces, a page per concept (output, clock and time, synthesis, input, analysis). Its overview says how an engine of the user's own drives the components.

How items are grouped:

- One item is something a user installs for itself. Split only where a piece is useful without the rest; code that only one piece uses ships in that piece's item (an item can hold several files).
- One page is a component a user puts on screen. A hook or a lib that serves one component is documented in a section of that component's page.
- Workstation and Devices parts are controlled and engine-agnostic: state comes in as values and live sources, changes go out through callbacks, never through one of our audio hooks. They must work over an engine of the user's own (an AudioWorklet, WASM).

The "API reference" of each component page is a hand-kept copy of the JSDoc of the matching parts in `packages/ui/src/primitives/<name>/elements/`. Nothing syncs them: change both in the same commit.

---

## Rules

### Registry items (`registry-audio/bases/base/components/{category}/`)

- Filename `block-{component}-{variant}.tsx` (blocks) or `{component}-{feature}-demo.tsx` (demos); default export `Block{Component}{Variant}` / `{Component}{Feature}Demo`, PascalCase of the filename, no params
- `"use client"` only if the file uses hooks, state or browser APIs
- Icons via `IconPlaceholder` (`@/components/icon-placeholder`) with a name for all five libraries (`lucide`, `phosphor`, `tabler`, `hugeicons`, `remixicon`), sized with `className="size-4"`, never a numeric `size`
- Each icon name is a string literal: the shadcn CLI turns `IconPlaceholder` into an import, so `lucide={playing ? "PauseIcon" : "PlayIcon"}` installs as invalid code. Render one element per icon (`{playing ? <IconPlaceholder … /> : <IconPlaceholder … />}`); `apps/www/test/install-paths.test.ts` fails on an expression
- Icon-only interactive elements get `aria-label`; decorative icons get `aria-hidden="true"`
- Static data outside the component function
- Semantic color tokens only (`text-muted-foreground`, `bg-primary`), never raw palette colors; don't add `border-border`, it's the default
- React imports are named, never `import * as React`
- `registryDependencies`: audio/ui items as `"@audio-ui/{name}"`, shadcn as `"@shadcn/{name}"`; npm imports go in `dependencies`
- Installed components land in `components/audio-ui/<file>.tsx` (hooks in `hooks/`, libs in `lib/`, blocks in `components/examples/`), so docs and the skill import them as `@/components/audio-ui/<name>`. `apps/www/test/install-paths.test.ts` fails on an import the registry doesn't install

### Published packages

- Relative imports carry the `.ts` extension (`./x.ts`, compiled with `rewriteRelativeImportExtensions`). A `.js` specifier breaks the www Turbopack build.
- Every user-visible change to `packages/core` or `packages/ui` needs a changeset (`bun run changeset`). Never edit `package.json` versions.
- `packages/ui` has size budgets (`bun run size`): keep new code out of primitives that don't need it.

### Writing (docs, changesets, comments, commit messages, UI copy)

- No em dashes. Use a comma, a colon or a period.
- Describe audio/ui's own API. Don't name the underlying headless library (Base UI) or the DAWs a feature is modeled on; only the peer dependency and imports name Base UI.
- Quote an MDX frontmatter `description:` that contains `": "`, or every docs page 500s.

### Before you call it done

1. `bun run lint:fix` (Biome via Ultracite: it enforces most style rules, so run it rather than memorising them)
2. After a registry change: `bun run registry:build` from `apps/www/`, **after** the last lint fix, so the generated JSON matches the formatted source
3. The checks CI runs on every PR:
   ```sh
   bunx biome ci packages/core packages/ui
   bun run build:pkg
   (cd packages/core && bunx tsc --noEmit && bun test)
   (cd packages/ui && bunx tsc --noEmit && bun test && bun run size)
   ```
   For `apps/www`: `bun run typecheck` and `bun test`.
4. For UI changes, look at the page in a browser (dev server on :4000) and tab through the controls.

---

## Workflow skills

Step-by-step guides for the recurring jobs live in `.claude/skills/` (mirrored at `.agents/skills/` for agents that read that path). Read the matching `SKILL.md` before starting:

- `add-registry-item`: add or change a block, demo, element, hook or lib in the registry
- `change-primitive`: change a primitive or the core logic of a published package
- `film-component`: render a component's video with `apps/video`

`skills/audio-ui/` is different: it's the skill we **ship** to people using the library, not a guide for working on this repo. One rule per file in `rules/`, compiled into its `AGENTS.md` by `bun run skill:build` (from `apps/www`); its [README](skills/audio-ui/README.md) explains how to add a rule. `apps/www/test/skills.test.ts` (run in CI) fails on a malformed rule, a stale `AGENTS.md`, or a registry item, entry, data attribute or CSS variable that doesn't exist: when you rename one, update the skill in the same commit.

---

## Working guidelines

These bias toward caution over speed. For trivial tasks, use judgment.

**Think before coding.** State your assumptions. If several interpretations exist, present them instead of picking silently. If a simpler approach exists, say so. If something is unclear, stop and ask.

**Simplicity first.** The minimum code that solves the problem: no speculative features, no abstraction for single-use code, no configurability nobody asked for, no error handling for impossible cases. If 200 lines could be 50, rewrite it.

**Surgical changes.** Touch only what the task needs. Match the existing style. Don't refactor or reformat adjacent code; mention unrelated dead code instead of deleting it. Do remove the imports and helpers your own change orphaned.

**Goal-driven execution.** Turn the task into checks you can run ("fix the bug" → a test that reproduces it, then passes), state a short plan with a check per step, and loop until the checks pass.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
