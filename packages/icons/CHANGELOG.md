# @audio-ui/icons

## 0.2.0

### Minor Changes

- 0c18239: Icons: `curveGlyph` and `CurveIcon` draw a function. `curveGlyph(fn, { from, to, min, max })` returns the glyph of a curve on the 24 grid, with the margin of the other icons; `CurveIcon` (from `@audio-ui/icons/react`) renders it with a `weight` and a `size`, so a button can draw what a device's own function does, in the style of the rest of the set.

## 0.1.0

### Minor Changes

- 1e69581: Icons: the first release. 63 glyphs for audio interfaces (a knob, a fader, a rack unit, a piano, the shape of a filter, a wave that dies away), one thin stroke on a 24 grid, in four weights (`regular`, `bold`, `duotone`, `fill`). `@audio-ui/icons` is data for any framework: the glyphs, the `catalog` with each icon's category and the words to find it by, `toSvg` for the text of an SVG file and `draw` for the same drawing as plain nodes. `@audio-ui/icons/react` is the React components, named for what they draw (`KnobIcon`, `LowpassIcon`).
