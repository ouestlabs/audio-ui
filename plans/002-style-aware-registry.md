# Plan 002: Make the registry build & serving style-aware (Base UI styles)

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. This plan changes a build
> script and the public registry URL layout — be precise and stop on any mismatch. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When done,
> update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 166a24c..HEAD -- apps/www/scripts/build-registry.ts apps/www/src/lib/registry.ts apps/www/src/registry/index.ts apps/sandbox/components.json`
> If any of these changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (but is a prerequisite for 003)
- **Category**: migration / dx
- **Planned at**: commit `166a24c`, 2026-06-21

## Why this matters

Today audio/ui serves a single, flat registry: `https://audio-ui.xyz/r/{name}.json`,
built from one `src/registry/default/` tree (the `base-luma` look). A consumer who
initialized shadcn with a different Base UI style (`base-nova`, `base-vega`, …) can still
install, but always gets the one base-luma-flavored payload. To "support other presets"
we need the registry to serve **per-style** payloads using shadcn's `{style}` URL
placeholder. This plan does the packaging change only: the build emits
`public/r/<style>/<name>.json` for every supported Base UI style, and the install URL
gains `{style}`. With no per-style overrides yet, every style emits a payload identical
to today's base-luma — so nothing breaks and any Base UI consumer resolves correctly.
Plan 003 then adds a genuinely different variant on top of this foundation.

## Current state

### The build script — `apps/www/scripts/build-registry.ts`

It has three stages. The relevant ones for this plan are `buildRegistryJsonFile()` and
`buildRegistry()`. Current shape (excerpts at `166a24c`):

```ts
// apps/www/scripts/build-registry.ts:77-136 — resolves item file contents, writes ONE registry.json, copies to public/r
async function buildRegistryJsonFile() {
  const fixedRegistry = {
    ...registry,
    items: await Promise.all(
      registry.items.map(async (item: RegistryItem) => {
        const files = await Promise.all(
          (item.files || []).map(async (file) => {
            const filePath = `src/registry/default/${file.path}`;        // <-- hardcoded "default"
            const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
            let content: string | undefined;
            try {
              const rawContent = await fs.readFile(resolvedPath, "utf-8");
              content = fixImport(rawContent);
            } catch (error) { console.warn(`Warning: Could not read file ${resolvedPath}:`, error); }
            const target = getFileTarget({ path: file.path, type: file.type, target: file.target });
            return { ...file, path: filePath, target, ...(content !== undefined && { content }) };
          })
        );
        return { ...item, files };
      })
    ),
  };
  rimraf.sync(path.join(process.cwd(), "registry.json"));
  await fs.writeFile(path.join(process.cwd(), "registry.json"), JSON.stringify(fixedRegistry, null, 2));
  const publicRDir = path.join(process.cwd(), "public/r");
  await fs.mkdir(publicRDir, { recursive: true });
  await fs.cp(path.join(process.cwd(), "registry.json"), path.join(publicRDir, "registry.json"), { recursive: true });
}

// apps/www/scripts/build-registry.ts:138-150 — shells out to the shadcn CLI
async function buildRegistry() {
  return await new Promise((resolve, reject) => {
    const process = exec("bunx shadcn build registry.json --output public/r");   // <-- flat output
    process.on("exit", (code) => { code === 0 ? resolve(undefined) : reject(new Error(`Process exited with code ${code}`)); });
  });
}
```

The entrypoint (bottom of the file, lines ~152–171) calls, in order:
`buildRegistryIndex()` → `buildRegistryJsonFile()` → `buildRegistry()`.

`buildRegistryIndex()` (lines 11–75) generates `src/registry/__index__.tsx` used by the
**docs app** to render previews; it points at `src/registry/default/...`. **Leave it
unchanged** — previews stay on the canonical (base-luma) tree.

### The import rewriter — `apps/www/src/lib/registry.ts` (`fixImport`, lines 145–183)

```ts
export function fixImport(content: string) {
  const fixed = content.replace(
    /@\/registry\/default\/ui\/audio\/([\w-]+)/g,                 // <-- hardcoded "default"
    (_, component) => `@/components/audio/${component}`
  );
  const regex = /@\/(.+?)\/((?:.*?\/)?(?:components|ui|hooks|lib|examples|particles))\/([\w-]+)/g;
  // ...generic rewrite for ui/hooks/lib/examples/particles...
  return fixed.replace(regex, replacement);
}
```

The first regex hardcodes `default`. Once override files live under
`src/registry/base-nova/ui/audio/...` (plan 003) and import siblings via that path, this
regex must match any style segment.

### Registry config — `apps/www/src/registry/index.ts`

Aggregates items from `registry-components.ts`, `registry-ui.ts`, etc. into
`registry.items`. Item file paths are style-agnostic (e.g. `"ui/audio/player.tsx"`); the
style prefix is added by the build. No change needed here.

### Consumer-facing endpoint references (must move to `{style}`)

- `apps/sandbox/components.json:23-25` →
  `"registries": { "@audio": "http://localhost:3000/r/{name}.json" }` and the file's
  `"style": "base-luma"` (line 3).
- `apps/www/src/content/docs/(root)/get-started.mdx:47` →
  `"@audio": "https://audio-ui.xyz/r/{name}.json"`
- `apps/www/src/components/layouts/doc/header/copy-page.tsx:26-27` →
  `- Registry endpoint: https://audio-ui.xyz/r/{name}.json`
  `- Install components with: npx shadcn@latest add https://audio-ui.xyz/r/{name}.json`
- `README.md` — references the endpoint `https://audio-ui.xyz/r/{name}.json`.

### Style names (authoritative, from shadcn CLI v4)

Named styles are `luma, nova, vega, maia, lyra, mira`. For Base UI they are written with
a `base-` prefix in `components.json` `style` (this repo already uses `base-luma`). The
full Base UI set this plan emits:
`base-luma, base-nova, base-vega, base-maia, base-lyra, base-mira`.

## Commands you will need

| Purpose          | Command                                            | Expected on success                          |
|------------------|----------------------------------------------------|----------------------------------------------|
| Install          | `bun install`                                      | exit 0                                        |
| Build registry   | `cd apps/www && bun run build:registry`            | exit 0; prints item count; writes `public/r/` |
| List output      | `ls apps/www/public/r`                             | one directory per style (see Done criteria)   |
| Validate JSON     | `cat apps/www/public/r/base-luma/player.json \| bun -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))'` | no error |
| Lint (autofix)   | `bun run lint:fix` (repo root)                     | exit 0                                        |
| Typecheck        | `cd apps/www && bunx tsc --noEmit`                 | exit 0 (no NEW errors)                        |

## Suggested executor toolkit

- The `shadcn` skill (if available) documents the `{style}` placeholder and
  `npx shadcn@latest registry validate` / `view` commands — useful for Step 5
  verification. Reference: shadcn docs "Registry → Namespaces" (`{name}`/`{style}`
  placeholders) and "registry.json".

## Scope

**In scope** (the only files you should modify or create):
- `apps/www/src/registry/styles.ts` — **create**: the `STYLES` list + helpers.
- `apps/www/scripts/build-registry.ts` — modify: loop the JSON build + CLI build per style.
- `apps/www/src/lib/registry.ts` — modify: make `fixImport`'s first regex style-agnostic.
- `apps/sandbox/components.json` — modify: endpoint → `{style}/{name}.json`.
- `apps/www/src/content/docs/(root)/get-started.mdx` — modify: endpoint → `{style}/{name}.json`.
- `apps/www/src/components/layouts/doc/header/copy-page.tsx` — modify: endpoint text.
- `README.md` — modify: endpoint reference.
- `apps/www/public/r/**` — regenerated build output; commit the regenerated tree.

**Out of scope** (do NOT touch):
- `apps/www/src/registry/default/**` — the canonical source files do not move or change.
  (Renaming `default/` is explicitly rejected — see `plans/README.md`.)
- `buildRegistryIndex()` and `src/registry/__index__.tsx` — docs previews stay on the
  canonical tree.
- `apps/www/components.json` `style` — the docs app keeps rendering in `base-luma`.
- Authoring any per-style override files or a docs style switcher — that is plan 003.

## Git workflow

- Branch: `advisor/002-style-aware-registry`
- Commit suggestion: `Make registry build style-aware and serve per-style payloads`.
- The regenerated `apps/www/public/r/**` is a large diff — commit it as its own commit
  (e.g. `Rebuild registry output (per-style)`) so the script change is reviewable apart
  from generated files.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the style configuration module

Create `apps/www/src/registry/styles.ts`:

```ts
// The canonical source tree all styles fall back to (base-luma look).
export const BASE_STYLE_DIR = "default";

// Base UI styles audio/ui serves. Each maps to a public/r/<style>/ output folder.
// A style only differs from base-luma if override files exist under
// src/registry/<style>/...; otherwise it falls back to BASE_STYLE_DIR.
export const STYLES = [
  "base-luma",
  "base-nova",
  "base-vega",
  "base-maia",
  "base-lyra",
  "base-mira",
] as const;

export type Style = (typeof STYLES)[number];
```

**Verify**: `cd apps/www && bunx tsc --noEmit` → no error referencing `styles.ts`.

### Step 2: Make `fixImport` style-agnostic

In `apps/www/src/lib/registry.ts`, change ONLY the first regex inside `fixImport` so it
matches any style segment instead of the literal `default`:

```ts
// before:
//   /@\/registry\/default\/ui\/audio\/([\w-]+)/g
// after:
const fixed = content.replace(
  /@\/registry\/[\w-]+\/ui\/audio\/([\w-]+)/g,
  (_, component) => `@/components/audio/${component}`
);
```

Leave the second (generic) regex and `replacement` untouched.

**Verify**: `grep -n "registry/\[\\\\w-\]\|registry/default/ui/audio" apps/www/src/lib/registry.ts`
shows the new pattern and no remaining hardcoded `default/ui/audio`. Then
`cd apps/www && bunx tsc --noEmit` → no new error.

### Step 3: Rewrite the build to emit per-style output

Modify `apps/www/scripts/build-registry.ts`. Goal: keep `buildRegistryIndex()` as-is,
then for **each style in `STYLES`** produce `public/r/<style>/<name>.json`.

Design (produce this behavior; match the file's existing import/style conventions):

1. Import the config: `import { STYLES, BASE_STYLE_DIR } from "@/registry/styles";`
2. Add a helper that resolves a file's source path for a style, preferring an override:

   ```ts
   async function resolveStyleSourceRel(style: string, filePath: string) {
     const overrideRel = `src/registry/${style}/${filePath}`;
     try {
       await fs.access(path.join(process.cwd(), overrideRel));
       return overrideRel;                                   // per-style override exists
     } catch {
       return `src/registry/${BASE_STYLE_DIR}/${filePath}`;  // fall back to default/
     }
   }
   ```

3. Generalize `buildRegistryJsonFile()` into `buildStyleRegistryJson(style)` that builds
   the same `{ ...registry, items }` object but resolves each file via
   `resolveStyleSourceRel(style, file.path)` for BOTH the read path and the emitted
   `path`. Write it to a per-style file, e.g. `registry.<style>.json` at `process.cwd()`.
   (Emitting `path` as the actual resolved source path is what lets the shadcn CLI read
   the right file in Step 4.)

4. Generalize `buildRegistry()` into `buildStyleRegistry(style)` that runs:
   `bunx shadcn build registry.<style>.json --output public/r/<style>`.

5. Replace the entrypoint sequence so it is:
   ```
   clean public/r
   buildRegistryIndex()                      // unchanged, docs-only
   for (const style of STYLES) {
     await buildStyleRegistryJson(style)
     await buildStyleRegistry(style)
   }
   ```
   Promote the `exec`-based `buildStyleRegistry` to await properly (the existing
   `buildRegistry` already wraps `exec` in a Promise — reuse that pattern, parameterized
   by style). Clean up the temporary `registry.<style>.json` files at the end (or write
   them under a git-ignored temp dir) so they don't litter the repo root — check
   `.gitignore`; if `registry.json` is currently ignored or committed, match that
   treatment for the per-style files.

**Verify** (build runs and emits per style):
```
cd apps/www && bun run build:registry
ls public/r
```
→ exit 0, and `ls public/r` lists exactly: `base-luma base-lyra base-maia base-mira base-nova base-vega`
(directories). Each should contain `player.json` (and the other item JSONs).

### Step 4: Confirm every style payload is currently identical to base-luma

Because no overrides exist yet, all styles must emit the same content. Compare a
representative item across two styles (ignore any absolute-path differences in a `path`
field if present):

```
diff <(cd apps/www && bun -e 'const j=require("./public/r/base-luma/player.json"); delete j.$schema; console.log(JSON.stringify(j.files?.map(f=>f.content)))') \
     <(cd apps/www && bun -e 'const j=require("./public/r/base-nova/player.json"); delete j.$schema; console.log(JSON.stringify(j.files?.map(f=>f.content)))')
```
**Verify**: no diff output (file CONTENTS are identical across styles). If they differ,
STOP — the resolver is picking up an unintended override or the build is style-leaking.

### Step 5: Validate the generated registry with the shadcn CLI

```
cd apps/www && bunx shadcn@latest registry validate public/r/base-luma/registry.json
```
(If a top-level `registry.json` is not emitted per style, validate an item JSON instead
via `bunx shadcn@latest view ./public/r/base-luma/player.json` — adjust to whatever the
build actually emitted.)

**Verify**: validation/view succeeds with no schema errors. If the CLI reports the output
layout is not what consumers expect (i.e. not `<style>/<name>.json`), STOP and report —
the serving contract must be `public/r/<style>/<name>.json` to match the `{style}` URL.

### Step 6: Switch the install URL to include `{style}`

Update every consumer-facing endpoint reference from `r/{name}.json` to
`r/{style}/{name}.json`:

- `apps/sandbox/components.json` line ~24:
  `"@audio": "http://localhost:3000/r/{style}/{name}.json"` (keep `"style": "base-luma"`).
- `apps/www/src/content/docs/(root)/get-started.mdx:47`:
  `"@audio": "https://audio-ui.xyz/r/{style}/{name}.json"`
- `apps/www/src/components/layouts/doc/header/copy-page.tsx:26-27`:
  `- Registry endpoint: https://audio-ui.xyz/r/{style}/{name}.json`
  Leave the second line's bare-URL `npx ... add https://audio-ui.xyz/r/{name}.json`
  example working: a bare URL has no `{style}` substitution, so point it at a concrete
  default style file instead: `.../r/base-luma/{name}.json` is wrong for a single item;
  use a real example like `npx shadcn@latest add https://audio-ui.xyz/r/base-luma/player.json`.
- `README.md`: update the endpoint line to `https://audio-ui.xyz/r/{style}/{name}.json`
  and, if it shows a bare `add` URL, use the `base-luma/player.json` concrete form.

**Verify**: `grep -rn "r/{name}.json" apps README.md` → no matches outside generated
output. `grep -rn "r/{style}/{name}.json" apps README.md` → matches in the four config/doc
locations.

### Step 7: Lint, typecheck, and rebuild clean

```
bun run lint:fix
cd apps/www && bunx tsc --noEmit
cd apps/www && bun run build:registry
```
**Verify**: lint exit 0; tsc no new errors; build exit 0 and `public/r/` still contains
the six style dirs.

## Test plan

This repo has no automated test runner for the registry (the build script IS the
verification). Treat these as the regression tests, run in order:

1. **Build succeeds & emits 6 styles** — Step 3 verify.
2. **Cross-style content parity (no accidental drift)** — Step 4 diff returns empty.
3. **Schema validity** — Step 5 CLI validate/view succeeds.
4. **No stale flat URLs remain** — Step 6 greps.
5. **Snapshot guard (optional but recommended)**: before your change, save the current
   `apps/www/public/r/player.json` to a temp file; after, confirm
   `public/r/base-luma/player.json`'s `files[].content` equals that saved content
   (base-luma must be byte-for-byte what shipped before). If it differs, STOP.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `apps/www/src/registry/styles.ts` exists and exports `STYLES` (6 entries) + `BASE_STYLE_DIR`
- [ ] `cd apps/www && bun run build:registry` exits 0
- [ ] `ls apps/www/public/r` → exactly the 6 style directories (`base-luma`, `base-nova`, `base-vega`, `base-maia`, `base-lyra`, `base-mira`)
- [ ] `apps/www/public/r/base-luma/player.json` and `apps/www/public/r/base-nova/player.json` have identical `files[].content` (Step 4)
- [ ] `base-luma/player.json` content matches the pre-change `public/r/player.json` content (Step 5 of test plan)
- [ ] `grep -rn "r/{name}.json" apps README.md` → no matches (outside generated `public/r`)
- [ ] `fixImport` first regex is `/@\/registry\/[\w-]+\/ui\/audio\/([\w-]+)/g`
- [ ] `bun run lint:fix` exits 0; `cd apps/www && bunx tsc --noEmit` exits 0 (no new errors)
- [ ] `git status` shows only in-scope files + regenerated `apps/www/public/r/**`
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `build-registry.ts`, `registry.ts`, or `index.ts` changed since
  `166a24c` and no longer matches the "Current state" excerpts.
- `bunx shadcn build` emits a layout other than `public/r/<style>/<name>.json` (e.g. it
  flattens, nests differently, or refuses the per-style registry.json). The serving
  contract is load-bearing for the `{style}` URL; report the actual layout instead of
  hacking around it.
- Step 4's cross-style diff is non-empty (styles are leaking different content before any
  override exists) — the resolver logic is wrong.
- Step 5's snapshot guard shows `base-luma` content changed vs. what shipped before — a
  silent regression in the canonical payload.
- `tsc` surfaces errors that trace to your edited files (as opposed to pre-existing
  unrelated errors).

## Maintenance notes

- **Adding/removing a style later** is a one-line edit to `STYLES` in `styles.ts` plus a
  rebuild. No build-script change needed.
- **Plan 003 depends on this**: it adds `src/registry/base-nova/...` override files; the
  `resolveStyleSourceRel` helper will start returning those, and `fixImport` (now
  style-agnostic) will rewrite their sibling imports correctly.
- Reviewer should scrutinize: (1) that `base-luma` output is unchanged vs. before (no
  consumer regression), (2) the per-style temp `registry.<style>.json` files are cleaned
  up / git-ignored, (3) the `{style}` URL is consistent across sandbox, docs, and README.
- Deferred out of this plan: per-style visual differences and any docs UI to preview
  styles — both are plan 003.
