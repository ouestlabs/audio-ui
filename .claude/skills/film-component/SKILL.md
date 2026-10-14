---
name: film-component
description: Render a video of an audio/ui component with the Remotion app in apps/video (a new component, an updated one, the whole library, or the teaser), or add or fix a component's showcase. Use when the user asks for a video, a clip, a render or a teaser of a component.
---

# Film a component

The full guide is [apps/video/README.md](../../../apps/video/README.md): read it first. Commands run from `apps/video/`; videos land in `out/` (1920×1080, 60 fps, landscape only).

```sh
bun run new <name>                                # first release, "New component" badge
bun run update <name> --note "…" --note "…"       # up to 3 notes; without --note they come from pending changesets
bun run showcase <name>                           # no status
bun run all                                       # every component
bun run teaser                                    # the 28 s library teaser
bun run studio                                    # preview, under Showcases
```

Add `--theme dark` for the dark theme.

## A component without a showcase

1. `src/showcases/<name>.tsx`: a component taking `{ t }` (seconds on screen) that renders the **real** registry element from `@/registry-audio/...`. Every value is computed from `t`: no state, no effects that animate. A frame is a pure function of `t`.
2. List it in `src/showcases/index.ts` with its title and its size alone on screen.
3. Check it in `bun run studio` before rendering.

## Gotchas

- Remotion seeks frames, it doesn't play them: CSS transitions and animations are off (`src/styles.css`). Anything that moves must come from `t`.
- `IconPlaceholder` is stubbed by `src/icon-placeholder.tsx` (the real one pulls in the whole design system) and draws only the Lucide icons in its `ICONS` map. Any other icon renders nothing: add it there.
- `webpack-override.ts` forces the automatic JSX runtime and resolves `@/` and `@audio-ui/*` to their sources. Restart the studio after changing it or `remotion.config.ts`. The config compiles to CommonJS, so no `import.meta`.
- One continuous camera, one object morphing into the next: no cuts, no crossfades, no overshoot.
