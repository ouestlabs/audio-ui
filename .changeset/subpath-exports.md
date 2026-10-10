---
"@audio-ui/react": minor
---

Make the package tree-shakable and add per-primitive entry points, Base UI style: `import { Knob } from "@audio-ui/react/knob"` (the root `@audio-ui/react` import keeps working). Primitives are no longer TypeScript `namespace` blocks — those compiled to side-effectful IIFEs, so importing `Knob` alone used to pull in every primitive (~21 KB gzip); it is now ~5.5 KB. Public names are unchanged (`Knob.Root`, `Knob.RootProps`, …).
