# Contributing to `audio/ui`

Thank you for your interest in contributing to `audio/ui`! This guide will help you understand how to contribute components, examples, particles, and library utilities to our design system.

## Overview

**audio/ui** consists of several types of items:

1. **UI Components** - Core reusable components (`Button`, `Input`, `Slider`, etc.)
2. **Examples** - Demonstrations of how to use UI components
3. **Particles** - Pre-assembled audio player patterns and composite components
4. **Library** - Utility functions and stores (`audio-store`, `audio-lib`, etc.)

## Project Structure

```
registry/default/
├── ui/          # UI components
├── examples/    # Example components
├── particles/   # Particle components
└── lib/         # Library utilities
```

## Adding New Examples

Examples are component demonstrations that showcase how to use our UI components.

### Step 1: Create the Example Component

1. Create a new file in `registry/default/examples/` with a descriptive name:
   ```bash
   touch registry/default/examples/audio-player-custom-demo.tsx
   ```

2. Write your example component:
   ```tsx
   // registry/default/examples/audio-player-custom-demo.tsx
   import {
     AudioPlayer,
     AudioPlayerControlBar,
     AudioPlayerPlay,
     AudioPlayerSeekBar,
   } from "@/registry/default/ui/audio/player"

   export default function AudioPlayerCustomDemo() {
     return (
       <AudioPlayer>
         <AudioPlayerControlBar>
           <AudioPlayerPlay />
           <AudioPlayerSeekBar />
         </AudioPlayerControlBar>
       </AudioPlayer>
     )
   }
   ```

### Step 2: Add to Registry Examples

Add your example to `registry/registry-examples.ts`:

```tsx
// registry/registry-examples.ts
import type { Registry } from "shadcn/schema"

export const examples: Registry["items"] = [
  // ... existing examples
  {
    name: "audio-player-custom-demo",
    description: "Custom audio player demo",
    type: "registry:example",
    registryDependencies: ["@audio/player"],
    files: [
      { path: "examples/audio-player-custom-demo.tsx", type: "registry:example" },
    ],
    categories: ["player"],
  },
]
```

**Important fields:**
- `name`: Unique identifier (kebab-case)
- `description`: Concise description
- `type`: Always `"registry:example"`
- `registryDependencies`: Array of registry components used (e.g., `["@audio/player"]`)
- `files`: Array with the file path
- `categories`: Array of categories for filtering

## Adding New Particles

Particles are pre-assembled components that combine multiple UI components into ready-to-use solutions.

### Step 1: Create the Particle Component

1. Create a new file in `registry/default/particles/`:
   ```bash
   touch registry/default/particles/particle-custom-player.tsx
   ```

2. Write your particle component:
   ```tsx
   // registry/default/particles/particle-custom-player.tsx
   import {
     AudioPlayer,
     AudioPlayerControlBar,
     AudioPlayerPlay,
   } from "@/registry/default/ui/audio/player"

   export default function ParticleCustomPlayer() {
     return (
       <AudioPlayer>
         <AudioPlayerControlBar>
           <AudioPlayerPlay />
         </AudioPlayerControlBar>
       </AudioPlayer>
     )
   }
   ```

### Step 2: Add to Particles Index

Add your particle to `registry/default/particles/index.tsx`:

```tsx
// registry/default/particles/index.tsx
import ParticleCustomPlayer from "./particle-custom-player"

export const particles: ParticleItem[] = [
  // ... existing particles
  {
    id: "particle-custom-player",
    component: ParticleCustomPlayer,
    category: ["player"],
    className: "**:data-[slot=particle-wrapper]:w-full", // Optional
  },
]
```

**ParticleItem properties:**
- `id`: Unique identifier (kebab-case)
- `component`: The component to render
- `category`: Array of categories for filtering
- `className`: Optional CSS classes for the wrapper
- `fullWidth`: Optional boolean for full-width display

### Step 3: Add to Registry Particles

Add your particle to `registry/registry-particles.ts`:

```tsx
// registry/registry-particles.ts
import type { Registry } from "shadcn/schema"

export const particles: Registry["items"] = [
  // ... existing particles
  {
    name: "particle-custom-player",
    description: "Custom audio player",
    type: "registry:block",
    registryDependencies: ["@audio/player", "@audio/store", "@audio/lib"],
    files: [
      { path: "particles/particle-custom-player.tsx", type: "registry:block" },
    ],
    categories: ["player"],
  },
]
```

**Important fields:**
- `name`: Unique identifier (kebab-case)
- `description`: Concise description
- `type`: Always `"registry:block"`
- `registryDependencies`: Array of registry components used
- `files`: Array with the file path
- `categories`: Array of categories for filtering

## Adding New Library Utilities

Library utilities are helper functions and stores that can be used across the project.

### Step 1: Create the Library File

1. Create a new file in `registry/default/lib/`:
   ```bash
   touch registry/default/lib/custom-utils.ts
   ```

2. Write your utility:
   ```tsx
   // registry/default/lib/custom-utils.ts
   export function formatTime(seconds: number): string {
     // Your implementation
   }
   ```

### Step 2: Add to Registry Lib

Add your library item to `registry/registry-lib.ts`:

```tsx
// registry/registry-lib.ts
import type { Registry } from "shadcn/schema"

export const lib: Registry["items"] = [
  // ... existing lib items
  {
    name: "custom-utils",
    description: "Custom utility functions",
    type: "registry:lib",
    dependencies: [],
    registryDependencies: [],
    files: [{ path: "lib/custom-utils.ts", type: "registry:lib" }],
    categories: ["lib", "utils"],
  },
]
```

## Adding New UI Components

UI components are core reusable components built on shadcn/ui.

### Step 1: Create the Component

1. Create a new file in `registry/default/ui/`:
   ```bash
   touch registry/default/ui/custom-component.tsx
   ```

2. Write your component following shadcn/ui patterns:
   ```tsx
   // registry/default/ui/custom-component.tsx
   import { cn } from "@/registry/default/lib/utils"
   import type * as React from "react"

   export function CustomComponent({ className, ...props }: React.ComponentProps<"div">) {
     return <div className={cn("custom-styles", className)} {...props} />
   }
   ```

### Step 2: Add to Registry UI

Add your component to `registry/registry-ui.ts`:

```tsx
// registry/registry-ui.ts
import type { Registry } from "shadcn/schema"

export const ui: Registry["items"] = [
  // ... existing components
  {
    name: "custom-component",
    type: "registry:ui",
    dependencies: [],
    registryDependencies: [],
    files: [
      { path: "ui/custom-component.tsx", type: "registry:ui" },
    ],
  },
]
```

## Registry Dependencies

When adding dependencies, use the correct format:

- **Official shadcn/ui components**: Use simple names (e.g., `"button"`, `"dialog"`)
- **Custom components from this registry**: Use namespace format (e.g., `"@audio/player"`, `"@audio/fader"`)
- **Library utilities**: Use namespace format with the registry name (e.g., `"@audio/store"`, `"@audio/lib"`)

Example:
```tsx
registryDependencies: [
  "@audio/player",      // Custom component
  "@audio/fader",       // Custom component
  "@audio/store", // Library store
  "@audio/lib",   // Library utilities
  "button",             // Official shadcn/ui
  "dialog",             // Official shadcn/ui
]
```

## Final Steps

After adding your component, run these scripts:

```bash
# Format code and fix linting issues
bun run lint:fix

# Build registry JSON files
bun run build:registry
```

## Guidelines

### Code Style
- Use TypeScript
- Follow existing naming conventions
- Use meaningful, descriptive names
- Keep components focused and single-purpose
- Use shadcn/ui patterns for UI components

### Categories
- Use categories that correspond to actual components or features
- For composite components, include all relevant categories
- Categories are used for filtering on the particles page

### Descriptions
- Keep descriptions concise but informative
- Focus on what the component does, not how it's implemented
- Descriptions appear in the registry and documentation

### Dependencies
- Be accurate with `dependencies` (npm packages) and `registryDependencies` (registry components)
- These are used for installation and dependency resolution

## Getting Help

- Check existing examples in `registry/default/examples/` for patterns
- Look at similar components for reference
- Review the [documentation](/apps/www/src/content/docs) for component usage
- Check the [GitHub repository](https://github.com/ouestlabs/audio-ui) for issues and discussions

Thank you for contributing to `audio/ui`! 🎉
