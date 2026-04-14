# audio/ui

**audio/ui** is an open-source library of accessible, composable Audio UI components for React — built on top of [shadcn/ui](https://ui.shadcn.com/), designed to be copied, pasted, and owned.

- Site: https://audio-ui.xyz · Repo: https://github.com/ouestlabs/audio-ui
- Registry endpoint: `https://audio-ui.xyz/r/{name}.json`

---

## Monorepo

Turborepo + Bun workspaces. **Always use `bun`, never `npm` or `pnpm`.**

```
audio-ui/
├── apps/
│   ├── www/        # Next.js docs site (Fumadocs + MDX) → localhost:3000
│   └── sandbox/    # Dev sandbox
└── packages/
    ├── ui/         # @audio-ui/react — published npm package (headless primitives)
    ├── utils/      # Shared utilities
    └── configs/    # Shared tsconfig, etc.
```

## Key Commands

```sh
bun run dev             # Start all apps
bun run build:pkg       # Build @audio-ui/react (what gets published to npm)
bun run lint:fix        # Auto-fix with Biome
bun run changeset       # Create a changeset before versioning
```

From `apps/www/`:
```sh
bun run build:registry  # Regenerate registry JSON — run after adding any component
```

## Stack

Next.js App Router · Fumadocs + MDX · Tailwind CSS v4 · shadcn/ui + Base UI · Phosphor Icons · Biome/Ultracite

## Where Things Live

### `@audio-ui/react` — headless primitives (`packages/ui/src/`)

- `primitives/` — Fader, Knob, Transport, XYPad, ChannelStrip (unstyled, accessible)
- `hooks/interactions/` — usePointerDrag, useWheel, useKeyboardNavigation, useFocus
- `hooks/state/` — useControlledValue, useValueAsRef

This package is **published to npm**. Don't break its public API without a changeset.

### Registry (`apps/www/src/registry/default/`)

Styled components users install via `npx shadcn@latest add @audio/player`:

```
ui/audio/          # provider, player, queue, track, playback-speed
ui/audio/elements/ # transport, fader, knob, xypad, channel-strip (styled wrappers)
blocks/            # Pre-assembled ready-to-use patterns (block-{component}-{variant}.tsx)
examples/          # Usage demos
lib/               # Utilities and stores (audio-store, etc.)
```

Registry config files — **update these when adding anything**:
- `registry/registry-ui.ts` · `registry/registry-components.ts`
- `registry/registry-examples.ts` · `registry/registry-blocks.ts` · `registry/registry-lib.ts`

### Docs (`apps/www/src/content/docs/`)

MDX files. Use existing custom components (`<Install>`, `<CodeTabs>`, `<Preview>`) — not raw HTML.

## Registry Rules

> [CONTRIBUTING.md](../CONTRIBUTING.md)

**After any registry change:** run `bun run build:registry` from `apps/www/`, then `bun run lint:fix`.

**Registry dependency format:**
- audio/ui items → `"@audio/{name}"`
- official shadcn/ui → plain name (e.g., `"button"`)

**Block rules** (`registry/default/blocks/`):
- Filename: `block-{component}-{variant}.tsx`
- Export: `export default function Block{Component}{Variant}()` — PascalCase of filename, no params
- `"use client"` only if the block uses hooks, state, or browser APIs
- Icons: named imports from `@phosphor-icons/react` only, no numeric `size` prop — use `className="size-4"`
- Icon-only interactive elements must have `aria-label`; decorative icons get `aria-hidden="true"`
- Static data defined outside the component function
- Semantic color tokens only — never raw Tailwind colors (`text-gray-500`, `bg-red-500`, etc.)
- Don't add `border-border` — it's the default
- React imports: named only, never the namespace (`import * as React`)

---

## Versioning & Publishing

Uses **Changesets**. Never edit `package.json` versions manually.

```sh
bun run changeset          # Describe what changed
bun run version-packages   # Bump versions
bun run release            # Build + publish
```

---

## General Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `npx ultracite fix`
- **Check for issues**: `npx ultracite check`
- **Diagnose setup**: `npx ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `npx ultracite fix` before committing to ensure compliance.
