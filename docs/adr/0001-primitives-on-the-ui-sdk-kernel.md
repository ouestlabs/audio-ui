# Primitives are written once, on the UI SDK kernel

Status: accepted, 2026-11-15. Amended 2026-11-17: the primitives were written in the registry rather than in a package, and `@audio-ui/primitives` was removed from the repository.

## Context

Each Primitive is written by hand for every framework. Its logic is shared (`@audio-ui/core` holds the controllers, about 13.8k lines), but each framework wires every part again: `@audio-ui/react` is about 12.5k lines and `@audio-ui/elements` about 12.3k, and Vue and Svelte have no adapter of their own. A new framework or a new behavior (an agent that sets a value, a change that reports where it came from) costs a rewrite per framework.

The UI SDK kernel (`@ui-sdk/core`, `definePrimitive`) describes a part once (its attributes, its events, its state) and renders it in React, Vue, Svelte, Solid and as custom elements. A spike on the branch `spike/ui-sdk` (`apps/ui-sdk-spike/FINDINGS.md`) built the knob and the meter on it, over our controllers unchanged.

What the spike showed:

- One knob description passes the published React knob's 48 tests and the published custom knob's 19, and one suite of 17 scenarios passes alike in React, Vue, Svelte and custom elements, with the same server HTML.
- In Chrome, a live meter holds 60 fps at 64 and 256 channels with no framework render, at the published meter's cost. The knob matches the published one pixel for pixel and reports `mouse` and `keyboard` as the source of a change.
- An agent finds a knob by its name, sets it with the source `agent`, and the app can refuse it.
- The first component costs 9 to 13 KB gzipped more than the published one; each one after costs less.

## Decision

1. **A Primitive's behavior is one description**, a `definePrimitive` over the controllers of `@audio-ui/core`. It lives in a new package, `@audio-ui/primitives`, which depends on `@audio-ui/core` and has `@ui-sdk/core` as a peer dependency. `@audio-ui/core` stays without a dependency.
2. **Rendering is a thin adapter per framework**, a `createParts` file and what a part draws inside itself, about 120 to 150 lines. It is copied through the registry, as a styled component is: the user owns it.
3. **`@audio-ui/react` and `@audio-ui/elements` are deprecated** once the primitives they publish exist in `@audio-ui/primitives`, over a transition of six months.
4. **One suite drives every framework.** A scenario of a primitive's behavior is written once, against the DOM a framework renders, and runs in React, Vue, Svelte and custom elements. A framework cannot fall behind another.
5. **The audio stays ours.** Scales, geometry, painting and the live sources are pure modules; UI SDK components are not used for an audio part. A page's own chrome (menus, dialogs) is the host's design system.

## Consequences

- The package depends on a beta (`0.1.0-beta.5`, published 2026-11-12). Pin it exactly until it is stable, and check each bump against the suite.
- A primitive is written with the kernel's rules, which the spike met the hard way: a collection's parts need a `"key"` prop (and `api.internal.keyOf`, which only the types mention); a callback is an event in Vue and in custom elements, so a formatter is a `"value"`; the source of a change is derived from its event; a slot's public state is typed by hand; there is no provider, so each framework writes its own.
- The meter subscribes once for all its channels, not once per channel as the spike did.
- Svelte ships as source: its tests need a compile step.
- Server rendering works in React, Vue and Svelte, which the custom elements never did.

## Open

- The Timeline and the PianoRoll are the largest Primitives and need their own spike on `createSpans` (several selected clips moved together, a zoom that changes the grid, fades, the loop region) before they move.
- Where an adapter's source lives (the registry, which users copy) and where the suite that drives it runs.
- Solid, Safari and Firefox, and a slow device, were not tried.
- Installation was tried in three empty projects (Vite React, Vite Vue, SvelteKit) with each framework's CLI: the code runs in all three, and each typechecks with no error (`tsc`, `vue-tsc`, `svelte-check`).
- Declarations: `tsc` could not emit `knob`'s inferred type, which names kernel types its entry does not export, so `knob` is annotated with an interface written out from the kernel's public types (`PrimitiveInstance`, `SlotDefinition`). Every primitive needs the same interface, kept in step with its slots by the typecheck of the adapters. The kernel's authors could export those types, which would remove it.
