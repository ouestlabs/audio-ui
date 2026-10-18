# @audio-ui/icons

Icons for audio interfaces: a knob, a fader, a rack unit, a piano, the shape of a filter. One thin stroke on a 24 grid, in four weights, as React components and as SVG.

```sh
npm install @audio-ui/icons
```

The package has two parts. `@audio-ui/icons` is data and works with any framework, or none: the glyphs, the catalog, `toSvg` and `draw`. `@audio-ui/icons/react` is the React 19 components.

```tsx
import { KnobIcon } from "@audio-ui/icons/react";

<KnobIcon weight="bold" size={20} />;
```

An icon takes the color of its text (`currentColor`), is `1em` wide unless `size` says otherwise, and is named for what it draws: `KnobIcon`, `TracksIcon`, `SineIcon`, `LowpassIcon`. React is an optional peer dependency: without it, only the data is used.

## Weights

`weight` picks how a glyph is drawn:

- `regular` (the default), a 1.5 line
- `bold`, a 2.25 line
- `duotone`, the line over a tint of the same color
- `fill`, the solid shape with its details cut out of it. A glyph made of lines only has no body to fill, so it is the bold line.

## Without React

```ts
import { catalog, draw, glyphs, toSvg } from "@audio-ui/icons";

toSvg(glyphs.knob, { weight: "fill", size: 24 }); // the text of an SVG file
catalog; // every icon, with its category and the words to find it by
draw(glyphs.knob, "bold", "knob"); // the same drawing as plain nodes, for Vue, Svelte or a custom element to render
```

`draw` returns `{ nodes, strokeWidth }`: each node is `{ tag, attrs, children? }`, and the SVG's own attributes (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, round caps and joins) are the same for every icon. The third argument names a mask when the weight needs one, so give each icon of a page its own.

The [Icons page](https://www.audio-ui.dev/docs/icons) lets you search the catalog, pick a weight and a size, and copy or save the SVG of an icon.

## Adding a glyph

Draw it in `src/core/glyphs.ts` with `path`, `circle` and `rect`, on a 24 grid with a 2px margin, and add its entry to `src/core/catalog.ts` and its React icon to `src/react/icons.ts`. Mark a closed shape `{ tint: true }` so it has a body in `duotone` and `fill`, a detail inside it `{ knock: true }` so `fill` cuts it out, and a shape that sits on a line `{ over: true }` so the line stops short of it. `bun test` draws every icon in every weight.
