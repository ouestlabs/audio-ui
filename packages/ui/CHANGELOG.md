# @audio-ui/react

## 0.1.2

### Patch Changes

- 364722e: Fix the seek bar freezing after a click in the track (or a drag released at the edge): `usePointerDrag` captured the pointer on `elementRef` — for Transport/Fader's Track that is the parent Slider node, so the browser retargeted the following pointermove/pointerup events away from the Track's handlers and the drag never ended, leaving `freezeValuesWhileDragging`'s optimistic value latched. Pointer capture now always targets the element carrying the handlers. Track drags also update live mid-gesture now, and the outside-click commit performs a full drag teardown so a frozen display can't stick through that path either.

## 0.1.1

### Patch Changes

- 1f56d20: Extract a value-shape-generic `useParameterCore` behind the internal `useParameter` hook and migrate XYPad onto it — all four primitives (Fader, Transport, Knob, XYPad) now share one parameter lifecycle. No public API changes. Fixes inherited by XYPad: zero-sized rect guards on drag geometry (previously division by zero) and clamped/guarded position percentages.

## 0.1.0

### Minor Changes

- cea33ba: Extract the internal `useParameter` hook: Fader, Transport, and Knob now share one implementation of value clamping/stepping, commit semantics, keyboard navigation, wheel handling, and the drag lifecycle. No public API changes. Fixes inherited by the unification: Fader now guards against zero-sized track rects (previously a division by zero), Fader's thumb position is guarded when `max === min`, and Transport gains the outside-click commit that previously existed only in Fader.

### Patch Changes

- 34233f9: Bump the `typescript` dev dependency to `^6.0.3`.

## 0.0.9

### Patch Changes

- 57a1f5d: Stabilize the `transform` callback passed to `useControlledValue` in `Fader`, `Knob`, `Transport`, and `XYPad` so it no longer gets a new reference every render — previously this silently invalidated the entire memoized callback chain (`setRawValue` → `updateValue`/`commitValue` → context value) on any incidental re-render, forcing every subcomponent to re-render even when nothing changed.

  Split `Fader`, `Transport`, and `XYPad` context into a config context (rarely changes: `disabled`, `orientation`, refs, callbacks) and a value context (changes every drag frame: `value`, `percentage`), so purely structural consumers (`Track`, `Slider`, `ThumbInner`, `ThumbMark`) stop re-rendering on every pointermove.

  Memoize `Knob`'s resolved drag config instead of rebuilding it on every render, and drop two `useMemo` calls in `usePointerDrag`/`useWheel` that were memoizing cheaper-than-the-memoization boolean checks.

## 0.0.8

### Patch Changes

- 871113e: Memoize Fader/Transport/XYPad context values to avoid re-rendering all subcomponents on every drag frame, stop Knob's `indicatorSpan` from rebuilding a new array on every render, switch internal hook imports to direct paths instead of barrel files, and fix a possibly-undefined ref access in `Knob.Slider`.

## 0.0.7

### Patch Changes

- 083a2be: - feat(ui): add ChannelStrip component and related primitives for audio UI
  - refactor(ui): enhance audio component styles for orientation responsiveness
  - refactor(www): align audio docs on channel-strip blocks and prune redundant demos

## 0.0.6

### Patch Changes

- b310ca8: Introduce the new `Transport` primitive export and migrate registry usage/docs from legacy slider naming to transport-focused APIs.

  Improve interaction quality and accessibility across audio primitives by tightening drag rendering behavior, adding robust labeling fallbacks, and refining thumb ergonomics in registry wrappers.

## 0.0.5

### Patch Changes

- f458ad7: Fix fader thumb positioning so it stays centered on the value track across orientations and thumb sizes, avoiding visible offset/line drift during interaction.

## 0.0.4

### Patch Changes

- 2f2b275: Improve knob interaction consistency in `@audio-ui/react` with refined drag mode behavior, wheel guard updates, and double-tap/double-click reset to `defaultValue`.

  Add `BiProcedure<T, U>` to `@audio-ui/utils` for two-argument callback typing used by updated interaction hooks.

## 0.0.3

### Patch Changes

- 0f5070f: remove workspace: from packages/ui/package.json

## 0.0.2

### Patch Changes

- fbdad8b: remove workspace: from package.json

## 0.0.1

### Patch Changes

- e649721: init
- Updated dependencies [e649721]
  - @audio-ui/utils@0.0.1
