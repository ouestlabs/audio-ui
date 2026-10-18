# @audio-ui/icons

The glyphs of audio/ui's site. Private for now: the registry draws its own shapes, and will move to this package once it is published.

One thin stroke on a 24 grid, in the weights of Phosphor:

- `regular` (the default), a 1.5 line
- `bold`, a 2.25 line
- `duotone`, the line over a tint of the same color

```tsx
import { KnobIcon } from "@audio-ui/icons";

<KnobIcon weight="duotone" />;
```

An icon takes the color of the text (`currentColor`) and is `1em` wide unless `size` says otherwise. It is named for what it draws: `KnobIcon`, `TracksIcon`, `SineIcon`, `LowpassIcon`.

## Adding a glyph

Draw it in `src/glyphs.ts` with `path`, `circle` and `rect`, on a 24 grid with a 2px margin, and export its icon from `src/index.ts`. Mark a closed shape `{ tint: true }` so it has a body in `duotone`; a glyph made of lines gets a `{ backdrop: true }` shape behind it. `bun test` checks that every icon draws in every weight.
