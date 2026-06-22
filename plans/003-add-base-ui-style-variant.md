# Plan 003: Ship a genuine second Base UI style variant (base-nova)

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the status
> row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 166a24c..HEAD -- apps/www/scripts/build-registry.ts apps/www/src/registry/styles.ts apps/www/src/lib/registry.ts`
> If `styles.ts` does not exist or the build is not style-aware, **plan 002 has not
> landed** — STOP: this plan depends on it.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-style-aware-registry.md`
- **Category**: feature / direction
- **Planned at**: commit `166a24c`, 2026-06-21

## Why this matters

Plan 002 makes the registry serve a per-style payload for every Base UI style, but every
style currently emits the same base-luma-flavored files. This plan proves the variant
mechanism end-to-end by authoring one **genuinely distinct** style — `base-nova` — as
override files, and (optionally) lets the docs site preview it. Once one real override
exists and installs correctly, adding the remaining styles (`vega`, `maia`, `lyra`,
`mira`) is the same repeatable recipe. Without this, "multiple style variants" is only
plumbing — no consumer can actually get a different look.

## Current state (assumes 002 landed)

- `apps/www/src/registry/styles.ts` exports
  `STYLES = ["base-luma","base-nova","base-vega","base-maia","base-lyra","base-mira"]`
  and `BASE_STYLE_DIR = "default"`.
- `apps/www/scripts/build-registry.ts` resolves each item file via
  `resolveStyleSourceRel(style, filePath)`: it uses `src/registry/<style>/<filePath>` if
  that file exists, else falls back to `src/registry/default/<filePath>`.
- `fixImport` (in `apps/www/src/lib/registry.ts`) rewrites `@/registry/<anyStyle>/ui/audio/<x>`
  and `@/registry/<anyStyle>/ui/<x>` → the consumer's `@/components/...` paths.
- The audio components that audio/ui actually ships and that carry styling worth varying
  live under `src/registry/default/ui/audio/` and `default/ui/audio/elements/`:
  - `ui/audio/player.tsx` (the big one)
  - `ui/audio/elements/{fader,knob,xypad,transport,channel-strip}.tsx`
  - `ui/audio/elements/sortable-list.tsx`
  These use semantic tokens (`bg-primary`, `text-muted-foreground`) and radius utilities
  (`rounded-lg`/`rounded-md` derive from `--radius`). Tokens + radius already adapt to the
  consumer's theme; what a style override changes is the **fixed class choices** (radius
  scale, border treatment, shadow/elevation, density/padding, focus-ring style) that are
  baked into the component rather than driven by a variable.

### What "nova" actually changes vs "luma"

Do NOT guess nova's visual language. Derive it from a real source before authoring:
- Run `npx shadcn@latest preset decode nova` (and `luma`) to see their theme/radius/font
  deltas, OR
- Scaffold a throwaway project in a temp dir and diff a primitive between the two styles:
  ```
  TMP=$(mktemp -d)
  npx shadcn@latest init --base base --preset nova --cwd "$TMP" --defaults --no-reinstall
  # inspect $TMP/components.json (radius, etc.) and an added primitive's classNames
  ```
  Use a temp dir **outside this repo** so nothing here is mutated.

The concrete per-component className deltas you apply are whatever that comparison shows
(commonly: a different `--radius` baseline → fewer hardcoded `rounded-*` overrides, a
flatter/sharper border + elevation treatment). If after this investigation the visual
delta between nova and luma for these audio components is negligible (≤ trivial class
tweaks), that is a finding — STOP and report it, because shipping a near-identical
override adds maintenance cost for no user-visible benefit, and the team may prefer to
keep nova as a pure fallback.

## Commands you will need

| Purpose         | Command                                              | Expected on success                    |
|-----------------|------------------------------------------------------|----------------------------------------|
| Build registry  | `cd apps/www && bun run build:registry`              | exit 0; writes `public/r/<style>/...`  |
| Inspect nova    | `npx shadcn@latest preset decode nova`               | prints nova's theme/config             |
| Diff payloads   | see Step 3                                            | base-nova differs from base-luma        |
| Lint (autofix)  | `bun run lint:fix` (repo root)                       | exit 0                                  |
| Typecheck       | `cd apps/www && bunx tsc --noEmit`                   | exit 0 (no NEW errors)                  |
| Dev preview     | `cd apps/www && bun run dev` → open localhost:3000   | docs render; component previews work    |

## Suggested executor toolkit

- The `shadcn` skill: `preset decode`, `preset resolve`, and the `{style}` placeholder
  docs. Use it to ground the nova styling rather than inventing it.
- The repo's component-authoring conventions in `.claude/CLAUDE.md` (Block rules section)
  apply to any audio component edits: Phosphor named imports, `className="size-4"` (no
  numeric `size`), semantic tokens only, `cn()` for conditional classes, no `space-*`.

## Scope

**In scope** (create/modify only these):
- `apps/www/src/registry/base-nova/ui/audio/**` — **create**: override copies of the
  audio component files whose styling genuinely differs under nova. Only create the files
  you actually restyle; everything else falls back to `default/` automatically.
- (Optional, Step 5) docs preview style switcher:
  - `apps/www/src/components/md/preview.tsx` — add a style selector that swaps which
    payload/source is shown.
  - A small client component for the selector if needed.
- `apps/www/public/r/**` — regenerated output; commit it.
- `plans/README.md` — status row.

**Out of scope** (do NOT touch):
- `src/registry/default/**` — the canonical base-luma source is the fallback; don't edit
  it to make nova work.
- `build-registry.ts`, `styles.ts`, `fixImport` — plan 002 already made these
  style-aware; if they need changes, that's a STOP (002 was incomplete).
- The other styles (`vega`, `maia`, `lyra`, `mira`) — out of scope here; this plan proves
  the recipe with nova. Adding the rest is follow-up using the same steps.
- The published npm package `@audio-ui/react` and its headless primitives — styling lives
  in the registry layer, not the package.

## Git workflow

- Branch: `advisor/003-base-nova-variant`
- Commit suggestion: `Add base-nova style variant for audio components`.
- Commit regenerated `public/r/**` separately from authored source, as in 002.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Ground the nova styling

Run `npx shadcn@latest preset decode nova` and the temp-dir scaffold from "What nova
actually changes" above. Write down the concrete deltas (radius baseline, border/shadow,
density) you will apply. **Verify**: you can state, in one sentence per property, how nova
differs from luma for these components. If you cannot find a real difference, STOP (see
that section).

### Step 2: Author the nova overrides

Pick the highest-signal component first — `ui/audio/elements/fader.tsx` (small, visual)
or `ui/audio/player.tsx` (flagship). Copy it from `src/registry/default/ui/audio/...` to
the same relative path under `src/registry/base-nova/ui/audio/...`, then apply the nova
className deltas from Step 1. Keep imports pointing at `@/registry/base-nova/...` for any
sibling audio file you also override, or `@/registry/default/...` for ones you don't
(both rewrite correctly via `fixImport`). Honor the CLAUDE.md component rules.

Repeat for each component whose look genuinely changes under nova. Do **not** copy files
that would be identical — let them fall back to `default/`.

**Verify**: `cd apps/www && bunx tsc --noEmit` → no new errors. Each new file lives under
`src/registry/base-nova/ui/audio/` and mirrors a real `default/` path.

### Step 3: Rebuild and confirm nova now differs from luma

```
cd apps/www && bun run build:registry
```
Then compare the overridden item across styles (example for player):
```
diff <(cd apps/www && bun -e 'const j=require("./public/r/base-luma/player.json"); console.log(JSON.stringify(j.files?.map(f=>f.content)))') \
     <(cd apps/www && bun -e 'const j=require("./public/r/base-nova/player.json"); console.log(JSON.stringify(j.files?.map(f=>f.content)))')
```
**Verify**: the diff is now **non-empty** for components you overrode, and still empty for
ones you did not (those fall back to luma). Build exits 0; all six style dirs still exist.

### Step 4: Verify an install resolves the nova payload

In a temp dir outside this repo, point a `components.json` `@audio` registry at the local
build (serve `apps/www/public/r` or use a file URL) with `"style": "base-nova"`, and dry-run
an add:
```
npx shadcn@latest add @audio/fader --dry-run     # with style base-nova configured
```
**Verify**: the CLI resolves `.../base-nova/fader.json` (not `base-luma`) and the dry-run
shows your nova classNames. If it fetches the luma payload, the `{style}` wiring from 002
is wrong — STOP and report.

### Step 5 (optional): Docs preview style switcher

Only if the team wants visitors to preview styles on the site. In
`apps/www/src/components/md/preview.tsx`, add a style `<Select>`/`<ToggleGroup>` (using the
repo's own `@/registry/default/ui/select` or `toggle-group`) that switches the **source**
shown in the Code tab between `public/r/<style>/<name>.json` payloads. Rendering a live
nova *preview* (not just source) would require the docs app to import nova component
variants too — that is a larger change; if you do it, load nova variants lazily and keep
base-luma the default. If this exceeds M effort, defer it and note so in the status row.

**Verify**: `cd apps/www && bun run dev`, open a component doc page, switch styles, confirm
the Code tab updates to the selected style's payload. `bunx tsc --noEmit` → no new errors.

### Step 6: Lint, typecheck, final rebuild

```
bun run lint:fix
cd apps/www && bunx tsc --noEmit
cd apps/www && bun run build:registry
```
**Verify**: all exit 0; six style dirs present; nova payload differs from luma for
overridden components.

## Test plan

Same "build-is-the-test" approach as 002:
1. **Override resolves** — Step 3 diff non-empty for overridden items, empty for others.
2. **Install picks nova** — Step 4 dry-run resolves the `base-nova` path.
3. **No luma regression** — `public/r/base-luma/<overridden>.json` content is unchanged
   vs. before this plan (the override must not leak back into luma). Confirm with a
   before/after snapshot of one overridden item under base-luma.
4. **Type/lint gates** — Step 6.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] At least one file exists under `apps/www/src/registry/base-nova/ui/audio/`
- [ ] `cd apps/www && bun run build:registry` exits 0; `ls apps/www/public/r` → 6 style dirs
- [ ] For each overridden item, `base-nova/<item>.json` `files[].content` ≠ `base-luma/<item>.json` (Step 3)
- [ ] For a non-overridden item, `base-nova/<item>.json` content == `base-luma/<item>.json` (fallback intact)
- [ ] `base-luma/<overridden>.json` content unchanged vs. before this plan (no luma regression)
- [ ] `npx shadcn@latest add @audio/<overridden> --dry-run` with `style: base-nova` resolves the nova payload (Step 4)
- [ ] `bun run lint:fix` exits 0; `cd apps/www && bunx tsc --noEmit` exits 0 (no new errors)
- [ ] `git status` shows only in-scope files + regenerated `public/r/**`
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `styles.ts` / style-aware build from plan 002 is missing — this plan can't run.
- Step 1 finds no meaningful visual difference between nova and luma for these components
  (shipping a near-duplicate override is not worth it — report and let the team decide).
- Step 3 shows luma content changed, or a non-overridden item stopped falling back to luma
  (the override is leaking).
- Step 4's dry-run fetches the luma payload despite `style: base-nova` (the `{style}` URL
  contract from 002 is broken).
- The docs switcher (Step 5) balloons past M effort — defer it, don't force it.

## Maintenance notes

- **Recipe to add the remaining styles** (`vega`, `maia`, `lyra`, `mira`): repeat Steps
  1–4 with that style's name; no infra changes. Document this recipe in `CONTRIBUTING.md`
  near the registry rules once nova proves it.
- Each override is a maintenance liability: when a `default/` audio component changes,
  every style override of that same file must be reviewed for the same logic change.
  Keep overrides limited to files whose **styling** truly differs; never fork behavior.
- Reviewer should scrutinize: (1) no `default/`/luma regression, (2) overrides differ only
  in className/styling — not in component logic, props, or accessibility, (3) the docs
  switcher (if added) keeps base-luma as the default and doesn't bloat the client bundle.
- Deferred: rendering live (not just source) per-style previews for all styles, and
  authoring vega/maia/lyra/mira — both follow the recipe above when prioritized.
