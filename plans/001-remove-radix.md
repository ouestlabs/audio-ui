# Plan 001: Remove Radix entirely so the project is Base UI only

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the status
> row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 166a24c..HEAD -- apps/www/package.json apps/www/src/lib/icons.tsx`
> If either file changed since this plan was written, compare the "Current state"
> excerpts below against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `166a24c`, 2026-06-21

## Why this matters

The project's goal is to be **Base UI only** (no Radix). Every component already uses
`@base-ui/react`; the only trace of Radix left is an unused `radix-ui` npm dependency in
`apps/www` and an unused "Radix UI" brand SVG icon. Removing both makes the dependency
graph honestly reflect the project's stance, shrinks `apps/www`'s install surface, and
prevents a future contributor from reaching for Radix because "it's already a dep."

## Current state

Two facts, verified at commit `166a24c`:

1. **`radix-ui` is a dependency but is never imported.**
   - `apps/www/package.json:40` → `"radix-ui": "^1.4.3",`
   - A repo-wide search for `@radix-ui` and `from "radix-ui"` in `apps/`/`packages/`
     source returns **zero** import sites. (`packages/ui` and `apps/sandbox` do not list
     it either.)

2. **The only `radix` reference is an unused brand icon** in
   `apps/www/src/lib/icons.tsx` (lines ~102–118):

   ```tsx
     radix: (props: IconProps) => (
       <svg fill="none" viewBox="0 0 25 25" {...props}>
         <title>Radix UI</title>
         <path d="M12 25C7.58173 25 4 21.4183 4 17C4 12.5817 7.58173 9 12 9V25Z" fill="currentcolor" />
         <path d="M12 0H4V8H12V0Z" fill="currentcolor" />
         <path d="M17 8C19.2091 8 21 6.20914 21 4C21 1.79086 19.2091 0 17 0C14.7909 0 13 1.79086 13 4C13 6.20914 14.7909 8 17 8Z" fill="currentcolor" />
       </svg>
     ),
   ```

   The key `radix` is referenced **nowhere** else (no `Icons.radix`, no `icon="radix"`).
   It sits in an object of brand icons (Tailwind, JSON, etc.).

Convention note: `icons.tsx` is a flat object literal of `name: (props) => <svg/>` entries.
Remove the whole `radix:` entry including its trailing comma; leave the surrounding
entries (the Tailwind icon above it, the `json` icon below it) untouched.

## Commands you will need

| Purpose            | Command                                   | Expected on success            |
|--------------------|-------------------------------------------|--------------------------------|
| Confirm no imports | `grep -rn "@radix-ui\|from \"radix-ui\"" apps packages --include="*.ts" --include="*.tsx"` | no matches |
| Install/update lock| `bun install`                             | exit 0; `bun.lock` updated     |
| Lint (check)       | `cd apps/www && bunx biome check .`       | exit 0                         |
| Lint (autofix)     | `bun run lint:fix` (from repo root)       | exit 0                         |
| Typecheck          | `cd apps/www && bunx tsc --noEmit`        | exit 0 (no NEW errors)         |

## Scope

**In scope** (the only files you should modify):
- `apps/www/package.json` — remove the `radix-ui` dependency line.
- `apps/www/src/lib/icons.tsx` — remove the `radix:` icon entry.
- `bun.lock` — will change automatically when you run `bun install`. Commit it.

**Out of scope** (do NOT touch):
- Any component file — none import Radix; nothing to migrate.
- `apps/sandbox` and `packages/*` — they do not depend on `radix-ui`.
- Other icons in `icons.tsx` — only the `radix` entry goes.

## Git workflow

- Branch: `advisor/001-remove-radix`
- Commit message style follows the repo's recent history (plain imperative summaries,
  e.g. "Update registry JSON files for consistent formatting"). Suggested:
  `Remove unused radix-ui dependency and brand icon`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm Radix is truly unused

Run:
```
grep -rn "@radix-ui\|from \"radix-ui\"\|from 'radix-ui'" apps packages --include="*.ts" --include="*.tsx"
```
**Verify**: no output. If there ARE matches, this is a STOP condition — a real Radix
usage exists and removal would break the build.

### Step 2: Remove the dependency from `apps/www/package.json`

Delete the line `"radix-ui": "^1.4.3",` (line ~40). Keep the JSON valid (no trailing
comma issues — the surrounding lines are other deps, so the comma on the previous/next
line is unaffected).

**Verify**: `grep -n "radix" apps/www/package.json` → no output.

### Step 3: Remove the `radix` icon from `apps/www/src/lib/icons.tsx`

Delete the entire `radix: (props: IconProps) => ( ... ),` entry shown in "Current state".

**Verify**: `grep -rn "radix" apps/www/src` → no output.

### Step 4: Refresh the lockfile and lint

```
bun install
bun run lint:fix
```
**Verify**:
- `bun install` exits 0 and `git status` shows `bun.lock` modified.
- `cd apps/www && bunx biome check .` exits 0.

### Step 5: Typecheck

```
cd apps/www && bunx tsc --noEmit
```
**Verify**: exit 0. (If `tsc` reports errors, confirm they are **pre-existing** by
checking they are unrelated to `icons.tsx`/`package.json`; if any error references your
changed files, fix it. If pre-existing unrelated errors block a clean exit, record that
in your status note rather than "fixing" out-of-scope code.)

## Test plan

There are no unit tests for `icons.tsx` or dependency manifests in this repo, and adding
one for an icon-object deletion would be noise. Verification is the build/lint/typecheck
gates above plus the grep checks. No new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "@radix-ui\|from \"radix-ui\"" apps packages --include="*.ts" --include="*.tsx"` → no matches
- [ ] `grep -n "radix" apps/www/package.json` → no matches
- [ ] `grep -rn "radix" apps/www/src` → no matches
- [ ] `bun install` exited 0 and `bun.lock` is updated
- [ ] `cd apps/www && bunx biome check .` exits 0
- [ ] `cd apps/www && bunx tsc --noEmit` exits 0 (or only pre-existing, unrelated errors remain — documented in the status note)
- [ ] `git status` shows only the in-scope files (+ `bun.lock`) modified
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's grep finds a real `@radix-ui`/`radix-ui` import — removal would break things.
- The `radix:` icon turns out to be referenced somewhere (e.g. a "built with" footer) —
  Step 3's verify grep would still show a hit after deletion. Investigate where it's
  used and report; do not silently delete the consuming UI.
- `bun install` fails or wants to change unrelated dependency versions.

## Maintenance notes

- After this lands, the project has zero Radix surface. If a future component genuinely
  needs a Radix-only primitive, that's a deliberate decision to revisit — it should not
  happen by accident because the dep was lying around.
- Reviewer should confirm the diff is exactly: one removed dep line, one removed icon
  entry, and a lockfile update — nothing else.
