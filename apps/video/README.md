# video

The motion videos of audio/ui, made with [Remotion](https://www.remotion.dev). They film the registry's real components, driven frame by frame: when a component changes, the next render shows it as it is now.

## Workflows

Run from `apps/video/`. Videos land in `out/` (1920×1080, 60 fps, H.264).

### A new component

```sh
bun run new <name>            # e.g. bun run new knob
```

Badge "New component", the title and description from the component's docs page, the component playing, then its install command typed in.

Before the first render, give the component a showcase:

1. Add `src/showcases/<name>.tsx`: a component that takes `{ t }` (seconds since it came on screen) and renders the registry component from `@/registry-audio/...`, with every value computed from `t`. No state, no effects that animate: a frame is a pure function of `t`.
2. List it in `src/showcases/index.ts` with its title and its size alone on screen.
3. Check it in `bun run studio`, under **Showcases**.

### An updated component

```sh
bun run update <name> --note "Marks around the dial, with labels" --note "Type a value in the readout"
```

Badge "Updated", the component playing, a "What changed" card (up to 3 notes) and the install command with `-o` to overwrite. Without `--note`, the notes come from the short sentences of the pending changesets that mention the component, and the script prints which it used.

### The teaser

```sh
bun run teaser
```

The whole library in 28 seconds: the glyph turns into the first knob, the controls and the editors one by one, then the whole instrument while it turns dark.

### Options

- `--theme dark`: render on the dark theme (light by default).
- `--version 0.3.0`: the `@audio-ui/react` version shown in the badge (the current one by default).

## Studio

```sh
bun run studio
```

Restart it after changing `webpack-override.ts` or `remotion.config.ts`.

## How it renders the registry

`webpack-override.ts` makes the bundle resolve like `apps/www`: `@/` is www's `src`, `@audio-ui/react` and `@audio-ui/core` are their sources, and CSS goes through the site's own `globals.css` (Tailwind, theme tokens, `style-vega`). Transitions and CSS animations are turned off in `src/styles.css`: a frame is seeked, not played. The site's `IconPlaceholder` is stubbed, since it pulls in the whole design system for icons a video never shows.

Remotion is free for individuals and companies of up to 3 people; past that it needs a [company license](https://www.remotion.dev/license).
