# Plan 004: Add a shadcn-style "/create" design-system builder page

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the status
> row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 166a24c..HEAD -- apps/www/src/components/theme apps/www/src/lib/themes.ts apps/www/src/registry/base-colors.ts apps/www/src/app`
> If the theme components or `base-colors.ts` changed materially since this plan was
> written, re-confirm the "Current state" excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/002-style-aware-registry.md` (for `{style}` install URLs and the
  Base UI style list). Works without `003`, but the style picker only shows real visual
  differences once variants exist (003 onward).
- **Category**: direction / feature
- **Planned at**: commit `166a24c`, 2026-06-21

## Why this matters

shadcn's [/create](https://ui.shadcn.com/create) page lets a visitor visually build a
design-system config (component library, icons, base color, theme, fonts, radius), preview
it live, and copy a setup command. The maintainer wants the same experience on audio/ui,
**adapted**: the live preview shows audio/ui's own components (player, fader, knob, xypad,
transport), and the output is the audio/ui install command for the chosen Base UI style.
This turns the homepage from "read the docs" into "configure and copy," and it showcases
the multi-style work from plans 002/003 — the style picker directly drives which
`@audio` registry payload the user installs.

## Reference: how shadcn builds it (read these before coding)

shadcn's source is the blueprint. Fetch the exact files with `gh` and mirror the
**structure and state model**, not the styling internals you can't reuse:

```bash
# Page skeleton (two-pane: Preview + Customizer side panel, plus a URL/preset handler):
gh api "repos/shadcn-ui/ui/contents/apps/v4/app/(app)/create/page.tsx" --jq '.content' | base64 -d
# State provider — the source of truth for what is configurable & URL-synced:
gh api "repos/shadcn-ui/ui/contents/apps/v4/app/(app)/create/components/design-system-provider.tsx" --jq '.content' | base64 -d
# The side-panel pickers (copy the ones we adapt):
for f in customizer base-color-picker theme-picker radius-picker font-picker icon-library-picker mode-switcher preview; do
  gh api "repos/shadcn-ui/ui/contents/apps/v4/app/(app)/create/components/$f.tsx" --jq '.content' | base64 -d > "/tmp/shadcn-create-$f.tsx"
done
# URL search-param schema:
gh api "repos/shadcn-ui/ui/contents/apps/v4/app/(app)/create/lib/search-params.ts" --jq '.content' | base64 -d
```

What to take vs. drop:
- **Take**: the two-pane layout, the `design-system-provider` state shape (style, theme,
  font, baseColor, chartColor, radius, menuAccent, mode, iconLibrary), URL-search-param
  syncing, the body-class mechanism (`style-<style>`, `base-color-<baseColor>`) and the
  injected `<style id="...-theme-vars">` for live CSS vars, and the picker UI patterns.
- **Drop** (out of scope for audio/ui): the compressed preset-code codec living in
  `packages/shadcn/src/preset/*`, the v0.dev integration (`create/lib/v0.ts`), randomize
  bias engine, undo/redo history, welcome dialog, and OG-image machinery. Use plain URL
  search params for sharing instead of a preset code — simpler and honest.

## Current state (what we already have to reuse — do NOT rebuild)

audio/ui already ships theme infrastructure; the create page composes it, it does not
duplicate it:

- `apps/www/src/components/theme/active.tsx` — `useThemeConfig()` context
  (`activeTheme` / `setActiveTheme`). The provider is mounted app-wide (see
  `apps/www/src/app/_providers/index.tsx`).
- `apps/www/src/lib/themes.ts` — `THEMES` list (the selectable color themes).
- `apps/www/src/registry/base-colors.ts` — `baseColors`, `baseColorsOKLCH`,
  `baseColorsV4` (OKLCH CSS-var sets per base color). This is what `registry-themes.ts`
  already maps into `theme-<color>` registry items.
- `apps/www/src/components/theme/customizer.tsx` — an existing **drawer** customizer with
  base-color + theme controls and a `CopyCodeButton`. The create page is the full-page,
  two-pane version of this; reuse its controls/logic where possible.
- `apps/www/src/components/theme/customizer-code.tsx` — generates the theme CSS/snippet
  from base colors via `lodash/template`. Reuse for the "copy theme" output.
- `apps/www/src/components/theme/selector.tsx` / `switcher.tsx` — theme `Select` and
  light/dark toggle. Reuse the switcher for the mode control.
- The Base UI **style** list comes from `apps/www/src/registry/styles.ts`
  (`STYLES`, created in plan 002). The style picker's options ARE that list.

Live-preview building blocks (the audio components to render in the Preview pane):
- `@/registry/default/ui/audio/player` (flagship), and elements `fader`, `knob`, `xypad`,
  `transport` under `@/registry/default/ui/audio/elements/*`. There are ready-made demos
  in `apps/www/src/registry/default/examples/` and home demos in
  `apps/www/src/app/(home)/elements/demo-grid.tsx` / `hero.tsx` — reuse these rather than
  authoring new demo content.

Routing/stack facts:
- Next.js App Router under `apps/www/src/app`. The home group is `app/(home)/`.
- Path alias `@/* -> src/*` (`apps/www/tsconfig.json`).
- Components/styling follow `.claude/CLAUDE.md`: Phosphor named imports, `className="size-4"`,
  semantic tokens only, `cn()`, no `space-*`, named React imports.
- For URL state, prefer the library already in the repo if present; otherwise plain
  `useSearchParams` + `useRouter` (check `apps/www/package.json` for `nuqs` before adding
  a dependency — do not add one if a pattern already exists).

## Commands you will need

| Purpose         | Command                                            | Expected on success            |
|-----------------|----------------------------------------------------|--------------------------------|
| Dev server      | `cd apps/www && bun run dev`                        | serves localhost:3000          |
| Typecheck       | `cd apps/www && bunx tsc --noEmit`                 | exit 0 (no NEW errors)         |
| Lint (autofix)  | `bun run lint:fix` (repo root)                     | exit 0                          |
| Prod build      | `cd apps/www && bun run build`                      | exit 0 (catches RSC/client errs)|
| Fetch reference | `gh api "repos/shadcn-ui/ui/contents/<path>" --jq '.content' \| base64 -d` | prints source |

## Scope

**In scope** (create unless noted):
- `apps/www/src/app/(home)/create/page.tsx` — the route (or `app/create/` if you prefer it
  outside the home group; match whichever layout chrome you want). Server component shell.
- `apps/www/src/app/(home)/create/components/` — `builder-provider.tsx` (state + URL sync),
  `customizer.tsx` (side panel), `preview.tsx` (live audio preview), individual pickers
  (`style-picker.tsx`, `base-color-picker.tsx`, `theme-picker.tsx`, `radius-picker.tsx`,
  `font-picker.tsx`, `icon-library-picker.tsx`, `mode-switcher.tsx`), and `install-command.tsx`
  (the copyable output).
- `apps/www/src/app/(home)/create/lib/search-params.ts` — the URL state schema.
- A link to `/create` from the home hero/nav (modify `apps/www/src/app/(home)/elements/hero.tsx`
  or the site header nav config — keep it a one-line addition).

**Out of scope** (do NOT touch):
- `packages/shadcn` preset codec, v0 integration, randomize/history — not ported.
- The registry build/serving (plan 002) and style variants (plan 003) — this page
  *consumes* them; it must not modify `build-registry.ts`, `styles.ts`, or `public/r`.
- Existing theme provider in `_providers/index.tsx` — reuse it; don't fork the theme
  context.
- `apps/www/src/registry/default/**` — render these components, don't edit them.

## Git workflow

- Branch: `advisor/004-create-builder-page`
- Commit suggestion: `Add /create design-system builder page`. Commit the route shell,
  pickers, and preview in logical chunks.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Define the builder state + URL schema

Create `lib/search-params.ts` and `components/builder-provider.tsx`. Mirror shadcn's
`design-system-provider` state, scoped to what audio/ui supports:

- `style` ∈ `STYLES` from `@/registry/styles` (default `base-luma`)
- `theme` ∈ `THEMES` (from `@/lib/themes`)
- `baseColor` ∈ keys of `baseColorsV4` (from `@/registry/base-colors`)
- `radius` (e.g. `none | sm | default | lg`)
- `font`, `fontHeading`
- `iconLibrary` (audio/ui uses Phosphor by default — offer at least `phosphor`; only add
  others if the docs already support them)
- `mode` (light/dark) — reuse the existing `useTheme()` from `@/hooks/use-theme`

Each field is read from and written to URL search params so the config is shareable.
Apply the selected `baseColor`/`theme` as live CSS vars using the same managed-`<style>` +
body-class technique as shadcn's provider (see the reference file). Reuse
`baseColorsV4`/`baseColorsOKLCH` for the variable values — do not hand-write OKLCH.

**Verify**: `cd apps/www && bunx tsc --noEmit` → no new errors. Changing a value updates
the URL (`?style=base-nova&theme=...`) and reloading restores it.

### Step 2: Build the Preview pane

Create `components/preview.tsx` rendering a representative audio/ui surface — the `player`
plus a couple of elements (`fader`, `knob`, `xypad`, `transport`). Reuse existing demos
from `apps/www/src/registry/default/examples/` or `app/(home)/elements/demo-grid.tsx`
rather than writing new ones. The preview must reflect the live CSS vars from Step 1 (it
lives inside the provider).

**Verify**: `bun run dev`, open `/create` → the audio player and elements render and visibly
restyle when you change base color / radius / mode.

### Step 3: Build the Customizer side panel + pickers

Create `components/customizer.tsx` as the narrow side panel (mirror shadcn's
`--customizer-width` two-pane layout from `create/page.tsx`). Compose the pickers:

- `style-picker.tsx` — options from `STYLES`. **This is the audio/ui-specific one**: it
  selects which Base UI style variant the install command targets.
- `base-color-picker.tsx`, `theme-picker.tsx`, `radius-picker.tsx`, `font-picker.tsx`,
  `icon-library-picker.tsx` — adapt from the fetched shadcn pickers, wired to the Step 1
  state. Use audio/ui's own UI primitives (`@/registry/default/ui/select`,
  `toggle-group`, `button`, `label`) — not shadcn's `@/styles/...` imports.
- `mode-switcher.tsx` — reuse `@/components/theme/switcher`.

**Verify**: every control changes the preview and the URL. `bunx tsc --noEmit` clean.

### Step 4: Build the install-command output

Create `components/install-command.tsx`. Given the selected `style`, emit the copyable
command that targets the per-style registry from plan 002:

```
npx shadcn@latest add https://audio-ui.xyz/r/<style>/player.json
```

Also offer a "copy theme CSS" action reusing `@/components/theme/customizer-code` to output
the chosen base-color/theme CSS variables. Use the repo's existing copy primitive
(`@/components/md/code` `CopyButton` or `@/hooks/use-copy-to-clipboard`).

**Verify**: selecting `base-nova` changes the command's URL to `.../r/base-nova/player.json`;
the copy button copies it. (If plan 002 has not landed, the URL still renders but the file
won't exist yet — note this in your status row.)

### Step 5: Link to /create and final checks

Add a single entry point (home hero CTA or site-header nav). Then:
```
bun run lint:fix
cd apps/www && bunx tsc --noEmit
cd apps/www && bun run build
```
**Verify**: lint 0; tsc no new errors; `next build` succeeds (this catches Server/Client
component boundary mistakes — all interactive pieces need `"use client"`).

## Test plan

This app has no component test runner; verification is the dev/build gates plus manual
interaction. Treat as regression checks:
1. **Route renders** — `/create` loads with preview + side panel (Step 2/3).
2. **Live restyle** — changing base color / radius / theme / mode visibly updates the
   audio preview (Step 2).
3. **URL state round-trips** — copy the URL, open in a new tab, identical config (Step 1).
4. **Install command tracks style** — Step 4 verify.
5. **Production build passes** — `next build` exit 0 (Step 5); no RSC/client errors.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `/create` route exists and renders a two-pane builder (preview + customizer)
- [ ] State fields (style, theme, baseColor, radius, font, mode, iconLibrary) are URL-synced and restore on reload
- [ ] Changing base color/radius/mode visibly restyles the live audio preview
- [ ] The install command reflects the selected Base UI style (`.../r/<style>/player.json`)
- [ ] Theme infra is **reused** (`useThemeConfig`/`THEMES`/`baseColorsV4`/`customizer-code`), not duplicated — `grep -rn "baseColorsV4\|useThemeConfig\|THEMES" apps/www/src/app/.../create` shows reuse
- [ ] A single link to `/create` exists from the home page or header nav
- [ ] `bun run lint:fix` exits 0; `cd apps/www && bunx tsc --noEmit` exits 0 (no new errors)
- [ ] `cd apps/www && bun run build` exits 0
- [ ] No files outside the in-scope list modified (besides the one nav/hero link)
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `apps/www/src/registry/styles.ts` does not exist — plan 002 hasn't landed; the style
  picker and install URLs have nothing to point at. Either run 002 first or build the page
  against a hardcoded `["base-luma"]` and flag it.
- The existing theme provider/context can't be reused cleanly (e.g. it's drawer-only and
  tightly coupled) — report the coupling rather than forking a second theme system.
- `next build` fails with a Server/Client boundary error you can't resolve by adding
  `"use client"` to interactive files after two attempts.
- Adapting a shadcn picker pulls in `packages/shadcn` preset-codec or v0 code — those are
  out of scope; stop and re-scope to plain URL params.

## Maintenance notes

- The style picker is the integration seam with 002/003: when a new Base UI style variant
  is authored (003 recipe), it appears here automatically via `STYLES` — no page change.
- Keep the page a **consumer** of theme infra. If theming needs new capability, add it to
  `theme/*` / `base-colors.ts` and let this page use it, so the docs customizer and the
  create page stay in sync.
- Reviewer should scrutinize: (1) all interactive components have `"use client"`,
  (2) no OKLCH values are hand-written (must come from `base-colors.ts`), (3) the page
  reuses existing primitives rather than importing shadcn's `@/styles/...` paths verbatim,
  (4) bundle impact of fonts — load preview fonts lazily, like shadcn's `create/preview/fonts.ts`.
- Deferred (not in this plan, possible follow-ups): shareable short "preset code" instead
  of long URLs, randomize button, undo/redo history, and per-style **live** preview (which
  needs 003's variants loaded client-side).
