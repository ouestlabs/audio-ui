![Audio UI Illustration](/apps/www/public/illustration.svg)

# audio/ui

Accessible, composable Audio UI components for React: knobs, faders, meters, pads, waveforms, timelines, piano rolls and the synths, mixers and players made from them.

- **Primitives on npm.** Headless, accessible parts with the behavior built in and the styling left to you: [`@audio-ui/react`](packages/ui), on the framework-agnostic [`@audio-ui/core`](packages/core).
- **Components you own.** A shadcn registry of styled components, blocks and hooks built on the primitives, copied into your project with the CLI.
- **Web Audio API first.** Meters, spectrum analyzers and tuners read real signals from `AnalyserNode`s, and live values move without re-rendering React.

Docs, demos and the catalog: **https://www.audio-ui.dev**

## Use it

```sh
# the primitives
npm install @audio-ui/react

# a styled component, and what it needs, from the registry
npx shadcn@latest add @audio-ui/knob
```

See [Get started](https://www.audio-ui.dev/docs/get-started) for the registry setup.

## Develop

Bun workspaces and Turborepo; use `bun` and `bunx`, not `npm` or `npx`.

```sh
bun install
bun run dev    # the docs site on http://localhost:4000
```

| Path | What it is |
| --- | --- |
| `apps/www` | The docs site and the registry (TanStack Start, Fumadocs) |
| `apps/video` | Remotion videos of the real components |
| `packages/core` | `@audio-ui/core`, framework-agnostic logic |
| `packages/ui` | `@audio-ui/react`, the headless primitives |
| `skills/audio-ui` | The agent skill we ship to people using the library |

Before opening a pull request:

```sh
bun run lint:fix
bun run build:pkg
```

The full list of checks, and how to add a component to the registry, are in [CONTRIBUTING.md](CONTRIBUTING.md). The words the code uses (Parameter, Commit, Primitive, Element) are in [CONTEXT.md](CONTEXT.md). Coding agents read [AGENTS.md](AGENTS.md).

## Resources

- [shadcn/ui registry](https://ui.shadcn.com/docs/registry)
- [Fumadocs](https://fumadocs.dev/)

## License

[MIT](LICENSE)
