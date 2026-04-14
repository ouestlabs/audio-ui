# Contributing to `audio/ui`

Thank you for your interest in contributing to `audio/ui`! This guide covers everything you need to know to add components, blocks, examples, and library utilities.

---

## Overview

**audio/ui** has four types of registry items:


| Type              | Location                     | Purpose                                             |
| ----------------- | ---------------------------- | --------------------------------------------------- |
| **UI Components** | `registry/default/ui/`       | Styled wrappers around `@audio-ui/react` primitives |
| **Blocks**        | `registry/default/blocks/`   | Pre-assembled, ready-to-use audio UI patterns       |
| **Examples**      | `registry/default/examples/` | Focused demos showing how to use one component      |
| **Library**       | `registry/default/lib/`      | Utilities and stores (`audio-store`, etc.)          |


---

## Project Structure

```
apps/www/src/registry/
├── default/
│   ├── ui/
│   │   ├── audio/          # AudioProvider, AudioPlayer, AudioQueue, AudioTrack...
│   │   └── audio/elements/ # Transport, Fader, Knob, XYPad, ChannelStrip (styled)
│   ├── blocks/             # block-{component}-{variant}.tsx
│   ├── examples/           # {component}-demo.tsx
│   └── lib/                # audio-store.ts, audio-lib.ts...
├── registry-ui.ts
├── registry-components.ts
├── registry-blocks.ts
├── registry-examples.ts
└── registry-lib.ts
```

---

## Block Development

Blocks are the main contribution surface. They are pre-assembled, copy-paste-ready patterns that combine `audio/ui`components.

### File Naming

**Location:** `apps/www/src/registry/default/blocks/`

**Convention:** `block-{component}-{variant}.tsx`

- `{component}`: primary component used (e.g., `player`, `queue`, `fader`, `channel-strip`)
- `{variant}`: optional descriptor for the variation (e.g., `widget`, `horizontal`, `multi`)
- Use hyphens throughout

**Examples:**

- `block-{component}.tsx` — standard variant
- `block-{component}-{variant}.tsx` — named variant (e.g., `horizontal`, `multi`, `compact`)

### Function Signature

**Default export named `Block` + PascalCase of the filename:**

```tsx
// block-{component}-{variant}.tsx
export default function Block{Component}{Variant}() {
  return (
    // JSX here
  );
}
```

- One default export per file, no parameters

### `"use client"` Directive

**Add `"use client"` only when the block uses:**

- React hooks (`useState`, `useEffect`, `useRef`, etc.)
- Event handlers that modify state
- Browser APIs (`window`, `document`, etc.)

**Do NOT add `"use client"` for:**

- Stateless components
- Components that only render UI
- Simple compositions without interactivity

```tsx
// ✅ Needs "use client" — uses state
"use client";

import { useState } from "react";
import { ComponentName } from "@/registry/default/ui/audio/{component}";

export default function Block{Component}() {
  const [active, setActive] = useState(false);
  return <ComponentName onActiveChange={setActive} />;
}
```

```tsx
// ✅ Does NOT need "use client" — stateless
import { ComponentName } from "@/registry/default/ui/audio/{component}";

export default function Block{Component}() {
  return <ComponentName />;
}
```

### Import Patterns

**Icons — named imports from `@phosphor-icons/react` only:**

```tsx
import { IconName, OtherIconName } from "@phosphor-icons/react";
```

Never import the entire library (`import * from "@phosphor-icons/react"`).

**Components — from the registry path:**

```tsx
import { ComponentName } from "@/registry/default/ui/audio/{component}";
import { ElementName } from "@/registry/default/ui/audio/elements/{element}";
```

**React — named imports only, never the namespace:**

```tsx
import { useState, useEffect, useId, useRef } from "react";
```

Don't import React at all for stateless components.

### Static Data

Define static data **outside** the component function:

```tsx
const items = [
  { id: "1", label: "Item One" },
  { id: "2", label: "Item Two" },
];

export default function Block{Component}() {
  return <ComponentName items={items} />;
}
```

---

## Icon Handling & Accessibility

### Icon Sizing

Never use numeric `size` props on icons. Use Tailwind classes when explicit sizing is needed:

```tsx
// ✅ Default context sizing (no size prop needed)
<button type="button">
  <IconName aria-hidden="true" />
</button>

// ✅ Explicit sizing with Tailwind
<IconName className="size-4" aria-hidden="true" />
<OtherIconName className="size-3.5" aria-hidden="true" />
```

Common icon sizes: `size-3` (12px) · `size-3.5` (14px) · `size-4` (16px, most common)

### `aria-hidden` and `aria-label`


| Context                                  | Rule                                                         |
| ---------------------------------------- | ------------------------------------------------------------ |
| Icon-only button                         | `aria-label` on the button, `aria-hidden="true"` on the icon |
| Button with icon + text                  | `aria-hidden="true"` on the icon (text is the label)         |
| Decorative icons                         | `aria-hidden="true"`                                         |
| Semantic icons (e.g., status indicators) | No `aria-hidden` — let screen readers announce them          |


```tsx
// ✅ Icon-only button
<button type="button" aria-label="Action label">
  <IconName aria-hidden="true" />
</button>

// ✅ Button with text + icon
<button type="button">
  <IconName aria-hidden="true" />
  Label
</button>

// ✅ Semantic icon (conveys meaning beyond decoration)
<span role="status">
  <IconName /> {/* no aria-hidden — meaning is conveyed by the icon */}
  Status label
</span>
```

Prefer `aria-label` over `sr-only` text spans for accessible names on interactive elements.

---

## Styling

### Use Semantic Color Tokens

Always use design tokens, never raw Tailwind color values:

```tsx
// ✅ Good
className="text-muted-foreground"
className="bg-destructive text-destructive-foreground"

// ❌ Bad
className="text-gray-500"
className="bg-red-500 text-white"
```

### `border-border` is the Default

Never add `border-border` — it's the default set in `globals.css`:

```tsx
// ❌ Redundant
className="border-b border-border"

// ✅ Correct
className="border-b"
```

### Hover States with `data-slot`

Prefer `in-*` selectors with `data-slot` over the `group` class pattern:

```tsx
// ❌ Avoid
<div className="group">
  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
</div>

// ✅ Prefer
<div>
  <ArrowRight
    aria-hidden="true"
    className="in-[[data-slot=button]:hover]:translate-x-0.5 transition-transform"
  />
</div>
```

---

## Registry Metadata

After creating a block, add its entry to `registry/registry-blocks.ts`:

```ts
{
  name: "block-{component}-{variant}",
  description: "Short description of what this block does",
  type: "registry:block",
  registryDependencies: ["@audio/{dep-a}", "@audio/{dep-b}"],
  files: [{ path: "blocks/block-{component}-{variant}.tsx", type: "registry:block" }],
  categories: ["{category}"],
}
```

**Required fields:**

- `name`: matches filename without `.tsx`
- `description`: ≤ 15 words, focus on what it does
- `type`: always `"registry:block"`
- `registryDependencies`: `@audio/{name}` for audio/ui items, plain name for shadcn/ui
- `files`: path + `type: "registry:block"`

**Registry dependency format:**

```ts
registryDependencies: [
  "@audio/{component}", // audio/ui component or lib → @audio/name
  "{shadcn-component}", // official shadcn/ui        → plain name
]
```

---

## Adding New Blocks

See the Block Development section above for naming, signature, and `"use client"` rules.

## Adding New Examples

### Step 1: Create the file

```tsx
// registry/default/examples/{component}-demo.tsx
import { ComponentName } from "@/registry/default/ui/audio/{component}";

export default function {Component}Demo() {
  return <ComponentName />;
}
```

### Step 2: Register in `registry-examples.ts`

```ts
{
  name: "{component}-demo",
  description: "Short description of what this example shows",
  type: "registry:example",
  registryDependencies: ["@audio/{component}"],
  files: [{ path: "examples/{component}-demo.tsx", type: "registry:example" }],
  categories: ["{category}"],
}
```

---

## Adding New UI Components

### Step 1: Create the component

```tsx
// registry/default/ui/audio/elements/{component}.tsx
import { cn } from "@/registry/default/lib/utils";
import type * as React from "react";

export function {ComponentName}({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("...", className)} {...props} />;
}
```

### Step 2: Register in `registry-ui.ts`

```ts
{
  name: "{component}",
  type: "registry:ui",
  dependencies: ["@audio-ui/react"],
  registryDependencies: [],
  files: [{ path: "ui/audio/elements/{component}.tsx", type: "registry:ui" }],
}
```

---

## Adding New Library Utilities

### Step 1: Create the file

```ts
// registry/default/lib/{utility}.ts
export function utilityFunction(input: InputType): OutputType {
  // implementation
}
```

### Step 2: Register in `registry-lib.ts`

```ts
{
  name: "{utility}",
  type: "registry:lib",
  files: [{ path: "lib/{utility}.ts", type: "registry:lib" }],
  categories: ["lib"],
}
```

---

## Final Steps (after any registry addition)

```sh
# 1. Fix linting
bun run lint:fix

# 2. Rebuild registry JSON
cd apps/www && bun run build:registry
```

---

## Block Creation Checklist

- File at `registry/default/blocks/block-{component}-{variant}.tsx`
- Default export named `Block{ComponentVariant}` matching the filename
- `"use client"` added only if hooks/state/event handlers are used
- Components imported from `@/registry/default/ui/{component}`
- Icons imported specifically from `@phosphor-icons/react`
- `aria-label` on all icon-only interactive elements
- `aria-hidden="true"` on all decorative icons
- Semantic color tokens used (no raw Tailwind colors)
- Static data defined outside the component function
- Entry added to `registry-blocks.ts` with correct `registryDependencies`
- `bun run lint:fix` passes
- `bun run build:registry` succeeds

---

## Code Style

This project uses **Biome via Ultracite**. Run `npx ultracite fix` before committing.

- TypeScript throughout — explicit types where they add clarity
- `const` by default, `let` only when needed, never `var`
- `async/await` over promise chains
- `for...of` over `.forEach()`
- Named imports from React (`import { useState } from "react"`)
- No `console.log` in production code
- Early returns over nested conditionals
- Meaningful, descriptive names — no magic numbers

---

## Getting Help

- Browse existing blocks in `registry/default/blocks/` for patterns
- Read docs at [https://audio-ui.xyz](https://audio-ui.xyz/docs)
- Open an issue on [GitHub](https://github.com/ouestlabs/audio-ui/issues)

Thank you for contributing to `audio/ui`!