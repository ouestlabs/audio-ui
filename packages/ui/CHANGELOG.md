# @audio-ui/react

## 0.3.2

### Patch Changes

- Updated dependencies [85fd7b8]
- Updated dependencies [43f455f]
  - @audio-ui/core@0.3.0

## 0.3.1

### Patch Changes

- 73e0cdf: Every primitive renders on the server again: Knob, Fader, XYPad, Envelope, Piano, Plot's handle, Timeline (root, track, clip, range) and Waveform (root, region) read their state through a store that had no server snapshot, so a framework prerendering client components, such as Next.js at build time, failed with "Missing getServerSnapshot". They now give the server the same snapshot as the client.

## 0.3.0

### Minor Changes

- aa6d721: Pad: a new primitive for drum pads, `Pad.Root` and `Pad.Item` from `@audio-ui/react/pad`, with its framework-free controller in `@audio-ui/core/pad`. Each pad sounds while held, by pointer or with Enter or Space, and reports `onPadOn(value, eventDetails)` with a velocity taken from the pointer's pressure, or else from how high on the pad it lands. Pads sharing a `chokeGroup` stop each other, `activePads` lights pads from elsewhere, and the pads are one tab stop walked with the arrow keys.

### Patch Changes

- Updated dependencies [aa6d721]
  - @audio-ui/core@0.2.0

## 0.2.2

### Patch Changes

- 51da2fa: No code change. This version is published through npm trusted publishing, so it carries a provenance attestation that links the package to the commit and the workflow that built it.
- Updated dependencies [51da2fa]
  - @audio-ui/core@0.1.2

## 0.2.1

### Patch Changes

- 5ad1c3f: Timeline: the viewport measures in layout px inside a scaled ancestor, such as a dialog that zooms in. The fitted zoom and the lanes' origin were taken from the drawn size, so the navigator's window showed a stretch that did not match the view until the next resize.
- Updated dependencies [3ad7d58]
  - @audio-ui/core@0.1.1

## 0.2.0

### Minor Changes

- d7a4e25: `Timeline.Clip` takes `additive`: every press on it is reported to `onSelectedChange`, as one with Shift, Cmd or Ctrl held is, so a selection can be built where there are no modifier keys, such as a touch screen.
- 802f8bc: Envelope: bend the segments, and drag with finer control.
  
  - **Curved segments:** a point takes an optional `curve`, from -1 to 1, that bends the segment leaving it; 0 or unset keeps it straight. A positive curve holds the start of the segment and rushes its end, a negative one the opposite. `Envelope.Line` and `Envelope.Fill` draw the bend.
  - **`Envelope.Segments` / `Envelope.Segment`:** a handle on each segment's midpoint. Dragging it up or down bends the segment so its midpoint follows the pointer; the arrow keys bend it, and a double click or Delete straightens it. It is a slider on the curve, and carries `data-flat` when the two points are at the same level and there is nothing to bend. A moved point keeps its segment's curve.
  - **Events:** `onValueChange` and `onValueCommitted` report bends with `reason: "curve"`.
  - **Fine drag:** holding Shift while dragging a point moves it a quarter of the pointer's distance, without a jump when Shift is pressed or released.
  - **Types:** `Envelope.Breakpoint` is `{ x, y, curve? }`, the type of the value.
  - **Grid:** `snap` takes the distance between grid lines in normalized units; the pointer snaps dragged and added points to it, and Cmd/Ctrl leaves the grid.
  - **Adding on a curve:** a point added inside a bent segment sits on the curve, and both halves are bent to follow it, so the shape is kept.
  - **Tab stops:** the segment handles are one tab stop; Left and Right move between them.
  - **Alt gestures:** as in a DAW's automation lane, Alt + drag on a segment bends it (reason `"curve"`), Alt + double click straightens it, and Alt + click on a point removes it. They sit beside the segment handles, which stay for touch and keyboard.
  - **Lost release:** a drag now ends when its button was released where the page could not see it, outside the window or over a menu.
- d682f2f: Add the Envelope primitive: an interactive breakpoint envelope built on SVG. `value: { x, y }[]` (normalized 0-1, the consumer maps it to its own time/level domain) drives a set of draggable points connected by straight segments.
  
  - Parts: `Root`, `Graph` (the SVG surface), `Line` and `Fill` (the curve and the area under it), `Points` (one child per point) and `Point` (the draggable handle). Every part takes a `render` prop and state-aware `className`/`style`; points expose `data-dragging`, `data-removable`, `data-blocked`, `data-disabled` and `data-index`.
  - Points are added by double-clicking the graph and removed by double-clicking a point or pressing Delete/Backspace on the focused one, within `minPoints` / `maxPoints` (equal values fix the shape); a refused action sets `data-blocked` briefly. Dragging only ever moves a point, and its x is clamped between its neighbors so points can never cross or reorder.
  - `onValueChange(points, eventDetails)` / `onValueCommitted(points, eventDetails)`, with `eventDetails.reason` (`"drag"`, `"keyboard"`, `"add"`, `"remove"`), `eventDetails.index` and `eventDetails.cancel()`. A dragged point follows the pointer even if a controlled `value` lags behind.
  - Keyboard: one roving tab stop; arrows nudge the focused point by `step` (Shift for ten steps). Each `Point` is a `role="slider"`: name it with `aria-label` and map its coordinates to real units with `getAriaValueText` (or `format`/`locale` on `Root`).
- f8f6969: Rework the `Fader` API. **Breaking (pre-1.0):**
  
  - Parts: `Root`, `Label`, `Value`, `Control` (was `Slider`), `Track`, `Indicator` (was `Range`), `Thumb`. The decorative `ThumbInner`/`ThumbMark` parts are gone, render your own elements inside `Thumb`.
  - Types live on each part: `Fader.Root.Props`, `Fader.Root.State`, `Fader.Root.ChangeEventDetails`, … (was `Fader.RootProps`).
  - `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` (was `onValueCommit(value)`), with `eventDetails.reason` (`"drag"`, `"track-press"`, `"keyboard"`, `"wheel"`, …) and `eventDetails.cancel()`.
  - The accessible name goes on `Thumb` (`aria-label` / `aria-labelledby`), which now renders a native `<input type="range">`. Disabled state is the presence attribute `data-disabled`.
  
  New: the `render` prop and state-aware `className`/`style` on every part, handler merging, `name`/`form` integration, `format`/`locale` with a formatted `Fader.Value` and `aria-valuetext`, `largeStep` (Shift+Arrow), RTL. Kept: vertical -60…+6 defaults, mouse-wheel stepping, and `touch-action: none` on `Control`. While dragged, the thumb always follows the pointer even if a controlled `value` lags behind (reject values with `eventDetails.cancel()`).
  - New `anchor`: the value `Indicator` fills from, such as `0` on a -1…1 pan, on whichever side of it the value is.
  - New `Mark`: a graduation along the track at a value, with `data-active` once the value has reached it from the anchor, and `data-orientation`.
- 55451a8: Rework the `Knob` API to match `Fader`. **Breaking (pre-1.0):**
  
  - Parts: `Root`, `Control` (was `Slider`: pointer drag, wheel, double-tap reset), `Track` and `Indicator` (the rail and value arcs, was `Arc`), `Thumb` (rotates with the value, was `Body` + the needle `Indicator`), plus new `Value` and `Label`. Draw your own pointer inside `Thumb`.
  - `dragMode: "circular" | "vertical" | "revolution"` replaces `dragSensitivity` and `dragOptions` (and its seven tuning thresholds). `"vertical"` is now a pure up/down drag.
  - The geometry props (`angleGapRad`, `angleOffset`, `angleRange`, `arcRadius`, `arcStrokeWidth`, `indicatorSpan`, `indicatorWidth`) are gone; `Track`/`Indicator` take a `strokeWidth`.
  - `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` (was `onValueCommit(value)`), with `eventDetails.reason` (`"drag"`, `"keyboard"`, `"wheel"`, `"reset"`, `"input-change"`) and `eventDetails.cancel()`.
  - The accessible name goes on `Thumb` (`aria-label` / `aria-labelledby`), which now renders a native `<input type="range">` (`name`/`form`, `aria-valuetext` from `format`/`locale` or `getAriaValueText`). Without a name, the knob is no longer labelled "Knob" automatically.
  - Every part takes a `render` prop and state-aware `className`/`style`, and exposes `data-disabled` / `data-dragging`. `largeStep` (default 10) drives Page Up/Down and Shift+Arrow keys.
  - New `scale`: `"linear"` (default), `"log"` for frequency, Q and ratios (every decade the same share of the dial; needs a positive `min`), or your own `{ toPosition, toValue }`. Drags move along the dial's travel; away from linear, keys and the wheel move 1% of it (10% with Shift and Page keys), always by at least one `step`. Without a `defaultValue`, the knob starts and resets at the middle of its travel.
  - Holding Shift while dragging, in any `dragMode`, turns the knob four times slower; small moves add up rather than rounding away.
  - New `Mark`: a graduation at a value, rotated to where it sits on the dial's scale (its `--knob-mark-angle` turns a label back upright), with `data-active` once the value has reached it from the anchor.
- d682f2f: Add the Meter primitive: a multi-channel level meter (stereo output, channel strips, any multi-channel source). Display only, there is nothing to control.
  
  - Parts: `Root` (the group), `Channels` (one child per channel), `Channel` (a `role="meter"`), `Track`, `Indicator` (the lit part), `Peak` (the peak-hold mark), `Value` (the formatted level) and `Label`. Channel parts expose `data-orientation` and `data-clipping` (at or above `clipThreshold`).
  - Levels come from `value` / `peak` props, or from a live `source` (`{ getSnapshot, subscribe }`, the shape of an external store). With a source the meter writes each frame straight to the DOM, so a signal updating 60 times a second never re-renders React; only a change in channel count does.
  - Each channel announces its level as a number (`format` / `locale`, one decimal by default), not as a share of the range; add the unit with `getAriaValueText`, e.g. `"-6 dB"`. Name channels with `aria-label` or `Meter.Label`.
  - Peak-hold timing and decay stay outside the primitive: the meter has no clock.
- c2a5437: Meter: a scale and a warning zone. `Meter.Mark` places a graduation at a level along the meter's length (upward for a vertical meter, rightward for a horizontal one), to hold a tick and a label such as -18. `warnThreshold` marks the channels between that level and the clip threshold with `data-warning`, for the amber of a level that is getting hot. A live clip now stays lit as `data-clipped` until a click on the meter clears it.
  
  `scale` spreads the levels along the length: `"linear"` (the default) or `"iec"`, the deflection of a digital peak meter, with more room at the top, where the registry element starts. A function gives your own curve. Marks and the indicator follow the same curve.
- 4cf5a0b: Piano: `onNoteOn` now carries a `velocity`, from 0.25 to 1, in its event details. A pointer press near the free end of a key plays harder than one near its top, as on a real keyboard; a key pressed from the keyboard plays at 0.8.
  
  Knob, Fader and XYPad return to their default value (`defaultValue`, or the middle) on a double click, an Alt + click or the Delete key, reporting `reason: "reset"`. Meter: a live clip stays lit as `data-clipped` until a click on the meter clears it.
- d682f2f: Add the Piano primitive: a keyboard to play, from `minPitch` to `maxPitch` (MIDI pitches, C3 to C5 by default) or exactly the `pitches` given. Parts: `Root`, `Keys` (renders its children once per key), `Key` and `KeyLabel`.
  
  - **Events:** `onNoteOn(pitch, eventDetails)` and `onNoteOff(pitch, eventDetails)`, with `reason` `"press"`, `"glide"` or `"keyboard"`. `eventDetails.cancel()` in `onNoteOn` keeps the key silent.
  - **Pointer:** a key sounds while pressed; dragging across the keys glides from one to the next, and each pointer holds its own key, so chords can be played on a touch screen. `activeNotes` lights keys from elsewhere, such as a MIDI input.
  - **Keyboard:** each key is a `<button>` named after its pitch ("C4"), behind one roving tab stop. The arrow keys walk the keys, an octave at a time with Shift or Page Up/Down, and Enter or Space holds the focused key until released.
  - **Layout:** `layout="keyboard"` places the keys like a piano, black keys between the white ones; `layout="even"` gives each key the same share, the way a piano roll's rows are. `orientation="vertical"` puts the low end at the bottom. Keys expose `data-color`, `data-active` and `data-orientation`.
  
  Also exported from `@audio-ui/react/piano`.
- e836035: Add the PianoRoll primitive: notes on a timeline, edited by pointer and keyboard. It sits inside a `Timeline.Root`, which gives it its length, zoom, grid and position, so a note's `start` and `length` are in the timeline's units (steps, beats, pulses) and every gesture lands on its grid unless Cmd/Ctrl is held. A note is `{ id, pitch, start, length, velocity? }`.
  
  Parts: `Root`, `Grid` (a timeline lane), `Rows` / `Row`, `Notes` / `Note`, `NoteHandle`, `Marquee`, `VelocityLane` / `Velocity`, and `Keys` / `Key` / `KeyLabel` for the keyboard down the side.
  
  - **Rows:** from `maxPitch` at the top to `minPitch`; with `folded`, only the pitches carrying notes get a row. `--piano-roll-rows` on the root counts them, so the grid and the keys can be sized per row, and every row-placed part sets `--piano-roll-row`. `Row` bands a pitch across the grid with `data-color`, `data-octave` (a C) and `data-active`.
  - **Drawing:** with `mode="draw"`, a press on empty grid adds a note of the length last drawn or resized, and its end follows the pointer. With `mode="select"` (the default), the press drags a selection rectangle (`Marquee`), Shift adding to the selection, and a double-click draws. Focused, the grid adds a note at the playback position with Enter, clears the selection with Escape and selects everything with Cmd/Ctrl+A.
  - **Editing:** dragging a note moves it, and the rest of the selection with it, keeping a chord's shape; with Alt the drag carries copies off. A `NoteHandle` per edge resizes it, the start trimming it from the front. Shift + click toggles a note in the selection, a double-click removes it. Notes are toggle buttons (`aria-pressed` for selected) in reading order: the arrow keys move them (Up and Down by a semitone, an octave with Shift), Shift + Left/Right changes their length, Enter or Space selects, Delete removes.
  - **Velocity:** `VelocityLane` is a timeline lane under the grid, with a `Velocity` bar per note at its start, as tall as its velocity. Dragging one moves the selection's velocities by the same amount, keeping a phrase's dynamics; a native range input inside takes the arrow keys. The velocity set last is what the next drawn note gets.
  - **Events:** `onValueChange` / `onValueCommitted` carry `reason` (`"draw"`, `"drag"`, `"keyboard"`, `"double-click"`, `"input-change"`) and `edit` (`"add"`, `"move"`, `"resize"`, `"duplicate"`, `"remove"`, `"velocity"`). The selection is controlled or not (`selection`, `onSelectionChange`). While a gesture edits the notes they follow the pointer even when a controlled `value` lags.
  - **Sound:** `onNoteOn(pitch, eventDetails)` / `onNoteOff` say when to audition a pitch: a key pressed, a note drawn, picked up or moved to a new pitch. `activePitches` lights keys and rows from elsewhere, such as the notes playing.
  - **Keys:** a `Piano` laid out on the roll's rows. Shift + press (or Shift + Enter) selects every note on a row.
- c118967: PianoRoll: editing commands from the keyboard, on the grid or on a note. Cmd/Ctrl+D repeats the selection right after itself and selects the copies; Cmd/Ctrl+C, X and V copy, cut and paste at the playback position; Q snaps the starts of the selection to the grid (every note when nothing is selected). They report `edit: "duplicate" | "paste" | "quantize" | "remove"` with `reason: "keyboard"`.
- 02bba03: Plot: a `Plot.Handle` returns to its `defaultValue` (or the middle of the plot) on a double click, an Alt + click or the Delete key, along the axes it moves along, reporting `reason: "reset"` to `onValueChange` and `onValueCommitted`, like Knob, Fader and XYPad.
- c378e46: Add the Plot primitive: two axes and what is drawn on them, for equalizers, filters and compressors. Values are in your own units, and each axis can be linear, `"log"` (the way frequency is drawn) or your own `{ toPosition, toValue }`.
  
  - **Root** owns the axes (`minX` / `maxX` / `scaleX`, and the same for y).
  - **Graph** is the drawing surface, an `<svg>` stretched over the plot; **Curve** draws `y = fn(x)` across it (with `fillTo`, closed down to a value as an area), **Line** a rule at an x or y value, **Mark** a label at a value on an axis, and **Band** a shaded stretch of one axis.
  - **Grid** draws grid lines and labels from the axes: round values spread along each axis you give, by powers of ten on a logarithmic one, or the `ticks` you name, with `format` and `count`; `formatTick` writes a value short ("1k").
  - **Trace** draws a live list of y values from a `source` (a spectrum, a level history) across the x axis, painted straight in the DOM without a React render per frame, on a scale of its own with `min` / `max`; **Dot** is a point that follows a live `{ x, y }`, such as the input level on a compressor's curve.
  - **Handle** is a point to drag, with a value in the axes' units and an `axis` to hold it to one of them. It moves from where it is rather than jumping to the pointer, four times finer with Shift, and holds a native `<input type="range">` per axis for the keyboard and the accessible names (`getAriaLabel`, `getAriaValueText`). Events carry `reason` (`"drag"`, `"keyboard"`, `"input-change"`) and can be cancelled.
  - **Cursor** follows the mouse or pen over the plot (not touch), setting `--plot-cursor-x` / `--plot-cursor-y` and `data-active` in the DOM for crosshair lines; **CursorReadout** writes what is under it as text through `format`.
  - **useValueAtPointer** turns a pointer position into a value on the plot, to add a point where someone double-clicks.
  
  Also exported from `@audio-ui/react/plot`.
- 8a34b12: Prune the public API down to audio primitives. **Breaking (pre-1.0):**
  
  - Remove the `ChannelStrip` primitive. It was layout only (`section`/`header`/`div`/`footer` with no behavior) and now lives in the styled registry layer as plain markup. Faders and meters no longer inherit `orientation` from an enclosing strip, pass `orientation` explicitly.
  - Remove the `Transport` primitive. It duplicated `Fader`; build a seek bar with `Fader` (`orientation="horizontal"`, `min`/`max` in your time unit) rendering any buffered range as your own element inside `Fader.Track`.
  - Stop exporting the generic hooks (`usePointerDrag`, `useWheel`, `useKeyboardNavigation`, `useFocus`, `useControlledValue`, `useValueAsRef`, `useCallbackRef`). They are internal implementation details, not audio primitives.
- 06453fd: The package depends on React alone: `@base-ui/react` is no longer a peer dependency, and an app that installed it only for audio/ui can remove it.
  
  `Fader`'s parts are now the package's own. They behave as before (a press on the track jumps to the value under it, a press on the thumb drags it from where it was taken, the arrow, Page, Home and End keys and Shift move it through a native `<input type="range">`, the wheel steps it, a double click, Alt + click or Delete returns to the default) and keep their data attributes (`data-orientation`, `data-disabled`, `data-dragging`). What changes is in the types: `Fader.Root.Props`, `Fader.Root.State` and the event details are defined here, with `format`, `locale`, `largeStep` and `name` on `Fader.Root`, and `getAriaValueText` and `inputRef` on `Fader.Thumb`. `Fader.Root.State` is `{ disabled, dragging, orientation, value }`. A `Fader` costs about 5 KB gzipped where it cost about 19 KB with the slider it used to build on.
- d682f2f: Rebuild the Sequencer primitive: a grid of steps, a row per sound (`value: boolean[][]`). Parts: `Root`, `Rows`, `Row` (named with `aria-label`), `Cells` and `Cell`, each step a toggle button with `aria-pressed`.
  
  - **Pointer:** a press flips a step and dragging on paints the new state across every step the pointer crosses, found from the cells' own boxes.
  - **Keyboard:** the steps are one tab stop; the arrow keys, Home and End (with Ctrl or Cmd, the corners of the grid) move between them, and Space or Enter flips one.
  - **Events:** `onValueChange(value, eventDetails)` with `reason` `"press"`, `"paint"` or `"keyboard"`, cancellable; `onValueCommitted` when a gesture that changed the pattern ends.
  - **Playhead:** `source`, the step being played as a live value, sets `data-current` on its cells straight in the DOM without re-rendering React; this replaces the `activeStep` prop.
  
  Also exported from `@audio-ui/react/sequencer`.
- c90b335: Sequencer: each step has a velocity, from 0 to 1. `Sequencer.Velocity` is a bar per step to put in a row under the cells: pressing it sets the velocity where the pointer is, dragging draws across the row, Alt + click or Delete returns the step to full, and a native range input inside takes the arrow keys, Page Up/Down and Home/End. `Root` takes `velocities` / `defaultVelocities` (a row per sound, like `value`; a step not listed plays at full) and reports `onVelocityChange` / `onVelocityCommitted` with `reason: "drag" | "keyboard" | "input-change" | "reset"`. The pattern itself is unchanged.
- 9c0f1ff: Make the package tree-shakable and add per-primitive entry points: `import { Knob } from "@audio-ui/react/knob"` (the root `@audio-ui/react` import keeps working). Primitives are no longer TypeScript `namespace` blocks, those compiled to side-effectful IIFEs, so importing `Knob` alone used to pull in every primitive (~21 KB gzip); it is now ~5.5 KB. Public names are unchanged (`Knob.Root`, `Knob.RootProps`, …).
- e8458ff: Add the clip to Timeline: a stretch of a source (a recording, a pattern) laid on a lane, with the model an arrangement needs.
  
  - **Clip** takes a `value` of `{ start, length, offset, fadeIn, fadeOut }` in the timeline's units, and `sourceLength`. Dragging its **ClipHeader**, the title bar, moves it, on the grid unless Cmd/Ctrl is held; a press on the body selects it and puts the cursor there instead, and a drag scrubs. The change says which lane is under the pointer (`eventDetails.lane`, any element marked by `Timeline.Lane`), and a drop on another lane commits even when the position did not change. It follows the pointer vertically through `--clip-drag-y`, and sets `--clip-offset`, `--clip-source-length`, `--clip-fade-in` and `--clip-fade-out` so its content can show the stretch that is played. `selected` / `defaultSelected` / `onSelectedChange` hold the selection, and Delete or Backspace call `onRemove`. Its native `<input type="range">` moves it from the keyboard and carries the accessible name.
  - **ClipHandle** trims one edge: trimming the start moves where in the source the clip begins and leaves its content where it is, trimming the end stops where the source or the timeline does.
  - **ClipFadeHandle** sets how long a fade lasts.
  - **ClipFade** draws a fade as the DAWs do (the ramp as a line, what it attenuates lightly shaded). `fadeInShape` / `fadeOutShape` (`"linear"`, `"fast"`, `"slow"`, `"smooth"`) set its curve; a fade handle steps through them on a double-click or Enter, and `fadeGain`, `nextFadeShape`, `setClipFadeShape` and `FADE_SHAPES` are exported.
  - A move whose drag began with Alt held has `eventDetails.copy`, for the app to add the dragged clip as a copy.
  - **Lane** takes `seekable`: a press on its bare area moves the position and a drag scrubs it, on the grid unless Cmd/Ctrl is held, so the cursor can be put anywhere along a track. Presses on the parts in the lane go to those parts.
  - `coverClips` lays a clip on a lane the way a DAW does: it covers what was under it, so a clip it lies over goes, one it overlaps by an edge is trimmed (its content staying in place), and one it lies inside is cut in two around it.
  - `adjacentPoint(points, from, direction)` finds the next or previous point (a locator, a cue) from a position, for jumping between them.
  - A move reports `eventDetails.delta`, how far the clip is from where the drag began, so an app can move a whole selection by the same amount, and `onSelectedChange` reports again a press that carries Shift, Cmd or Ctrl (`eventDetails.event`) so a selection can be added to or taken from.
  - `onDragOffsetChange(offset)` follows a clip dragged up or down (in px from where the press began, and 0 when the drag ends), even when nothing moves along the lane, so the rest of a selection can follow it.
  - Events carry `eventDetails.target` (`"move"`, `"trim-start"`, `"trim-end"`, `"fade-in"`, `"fade-out"`) and `reason` (`"drag"`, `"keyboard"`, `"input-change"`).
  - The edits are plain functions too, for the model behind the clips: `moveClip`, `trimClipStart`, `trimClipEnd`, `setClipFadeIn`, `setClipFadeOut`, `splitClip`, `duplicateClip` and `clipEnd`, exported from `@audio-ui/react` and `@audio-ui/react/timeline`.
- 8ca3a5e: Add the Timeline primitive: the base for an arrangement view, a clip editor or a piano roll. Units are the consumer's (seconds, beats, pulses, steps); the primitive has no notion of tempo.
  
  - **Root** owns the length (`duration`), the zoom (`zoom` / `defaultZoom` in px per unit, clamped to `minZoom`…`maxZoom`, `onZoomChange`), the grid (`snapStep`, `snapOffset`) and the playback position (`position` / `defaultPosition`, or a live `source` followed outside React; `onPositionChange` / `onPositionCommitted`). Without a zoom it fits the width it is given.
  - **Viewport** is the scrolling window. Cmd/Ctrl + wheel (and trackpad pinch) zooms around the pointer, and every zoom change keeps its anchor point in place, or the middle of the view when there is none.
  - **Lane** is a strip parts are placed on, as long as the timeline when zoomed. It sets `--timeline-unit`, the width of one unit, so anything placed with it follows the zoom.
  - **Ruler** seeks: a press jumps to the pointer and a drag scrubs, on the grid unless Cmd/Ctrl is held, four times finer with Shift. It holds a native `<input type="range">` for focus, the keyboard and the accessible name, announced through `getAriaValueText`.
  - **Range** is a stretch of the timeline (`[start, end]`): a loop, a selection, a clip. Dragging its body moves it and a **RangeHandle** per edge resizes it, both on the grid unless Cmd/Ctrl is held and never shorter than `minLength`; with `drawable`, dragging across empty lane draws a new one. The range and each handle hold a native `<input type="range">`, so all of it works from the keyboard. Events carry `eventDetails.edge` and `reason` (`"drag"`, `"draw"`, `"keyboard"`, `"input-change"`).
  - **Navigator** is the whole timeline as one bar with the visible stretch inside it: dragging its **NavigatorWindow** scrolls, dragging a **NavigatorHandle** zooms while holding the other edge, a double-click fits everything. Window and handles hold native range inputs too.
  - **Mark** places something at a value; **Playhead** follows the position through its own `--timeline-offset` variable, without re-rendering React.
  
  Also exported from `@audio-ui/react/timeline`.
- a8dda2c: Timeline: `Timeline.Ruler` selects a stretch when you drag with Shift held, reported as `[start, end]` through `onSelectionChange` / `onSelectionCommitted` (`reason: "drag"`), on the grid unless Cmd/Ctrl is held. Feed it to a `Timeline.Range` as a loop. A plain press and drag still move the position, and without the handler Shift changes nothing.
- 7e7fc9f: Timeline has tracks: `Timeline.Track` is a row with a header beside a lane and a height you hold (`height`, `onHeightChange`, `onHeightCommitted`, `selected`), `Timeline.TrackHeader` is the strip that names it and stays at the left edge while the lane scrolls, and `Timeline.TrackResizeHandle` resizes it by dragging or with the arrow, Page and Home/End keys through a native range input. A double-click on the handle clears the height (`onHeightChange(undefined)`), so the track shares the room again.
- 1ad2ec3: Knob and Fader: `Value` takes `editable`. A double click on the readout, or Enter while it has focus, swaps it for a text field holding the value; Enter or leaving the field commits what was typed, Escape drops it. A unit or a decimal comma is fine ("-6 dB", "12,5"), the number is rounded to `step` and clamped, and it is reported with `reason: "input-change"`. The readout takes the pointer events it receives, so inside a thumb it does not also drag or reset.
- a0df6a2: Add the Waveform primitive: one family of parts for drawing audio, whether it is a file you scrub through or a signal as it happens.
  
  - **Data**: `Root` takes `peaks` (at any resolution: 0-1 amplitudes, or `{ min, max }` with each slice's lowest and highest sample, which draws the waveform lopsided where the audio is) or `levels`, a live signal (`{ getSnapshot, subscribe }` whose snapshot is the current levels). While a live signal is audible the root carries `data-active`; `loading` marks every part and makes the bars sweep.
  - **Canvas** draws on the device pixel grid: as many bars as fit its real width, the loudest amplitude kept per bar, every edge on a physical pixel at any pixel density or zoom level. `variant` is `mirror`, `bars` or `line`; `barWidth`, `barGap`, `barRadius` and `minBarHeight` size the bars, `gain` scales them. With a live signal, `mode="static"` spreads the current levels across the width (rising at once, falling smoothly, optionally `mirrored`, with an `idle` animation) and `mode="scrolling"` records the loudest one over time at `scrollSpeed`, entering from the right, or from the middle outwards when `mirrored`. The `scope` variant takes raw samples (-1 to 1) instead and traces them as one line of `lineWidth`. Colors come from CSS (`--waveform-color`, `--waveform-progress-color`, `--waveform-bar-radius`).
  - **Bars** / **Bar** draw the same levels as a fixed `count` of elements, for a visualizer styled in plain CSS: each bar's level is its `--waveform-level` variable, and bars the position has passed carry `data-played`.
  - **Seek**: `Control` is the seekable surface and holds a native `<input type="range">`; leave it out for a waveform that is only shown. A press jumps to the pointer and a drag scrubs; arrow keys step by `step`, Page Up/Down and Shift + arrows by `largeStep`, Home/End jump to the bounds. `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` carry `eventDetails.reason` (`"press"`, `"drag"`, `"keyboard"`, `"input-change"`) and `eventDetails.cancel()`. `value` runs from `0` to `duration` (default `1`).
  - **Live position**: pass a `source` and the waveform follows it straight in the DOM, playhead, canvas and input, without re-rendering React. While the pointer scrubs, neither the source nor a late controlled `value` pulls the position back. The position is exposed as `--waveform-position`, and announced as the played share unless `getAriaValueText` returns something else.
  - **On the timeline**: `Region` is a stretch (`[start, end]`) that moves when its body is dragged, and `RegionHandle` resizes one `edge` by pointer or keyboard through its own native range input, stopping `minLength` short of the other edge; their events carry `eventDetails.edge`. `Marker` is a point at `value`. `Playhead` and `Thumb` follow the position, and `Hover` shows at the hovered one.
  - Everything that moves is painted outside React, only when something changed, and not at all while off screen. With reduced motion requested, live waveforms repaint a few times a second, without smoothing, idle animation or sweep.
  - **Range**: `range` shows just a stretch of the audio, `[start, end]` in `duration` units, such as a clip's window onto its source. Bars, seeking, the input's bounds, hover, regions and markers follow it; while the position is outside it the root carries `data-outside`. Canvases larger than browsers allow are drawn coarser rather than blank.
  
  Also exports `createSource(initial)`: a `{ getSnapshot, subscribe, set }` store to push a live signal into any primitive's source yourself.
- 44e68fb: Waveform: `Waveform.Control` selects a stretch when you drag with Shift held, reported as `[start, end]` through `onSelectionChange` / `onSelectionCommitted` (`reason: "drag"`), ready to feed a `Waveform.Region` as a loop or a selection. A plain press and drag still seek, and without the handler Shift changes nothing.
- 0dbd6ca: Rework the `XYPad` API to match `Fader` and `Knob`. **Breaking (pre-1.0):**
  
  - Parts: `Root`, `Control` (was `Slider`: press, drag, wheel), `Thumb` (was `Cursor`), `Value` (was `ValueDisplay`) and `Label`. The decorative parts (`Grid`, `GridLine`, `Crosshair`, `CursorGlow`, `CursorDot`, `CursorHighlight`) are gone: draw grids and crosshairs with your own elements and the new `--xy-pad-x` / `--xy-pad-y` CSS variables.
  - `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` (was `onValueCommit(value)`), with `eventDetails.reason` (`"press"`, `"drag"`, `"keyboard"`, `"wheel"`, `"input-change"`) and `eventDetails.cancel()`.
  - `Thumb` renders one native `<input type="range">` per axis, named from `aria-label` ("… X" / "… Y") or `getAriaLabel(axis)`. The pad no longer injects an English "XY Pad" label, usage instructions, or a live status region.
  - `defaultValue` now defaults to the center of the pad (was the bottom-left corner). `Home` / `End` move X to its min / max (were the top-left / bottom-right corners); `Shift` + arrows move 10 steps. The wheel follows the scroll direction: up raises Y, right raises X.
  - Every part takes a `render` prop and state-aware `className`/`style`, and exposes `data-disabled` / `data-dragging`. `format`/`locale` feed `XYPad.Value` and each input's `aria-valuetext`. `XYPad.Value` joins the two axes with "; " in locales whose decimal mark is a comma, so "2,5; 0,5" can't be misread.
  
  Also: `Fader`, `Knob` and `XYPad` treat a non-finite controlled value (`NaN`, `±Infinity`) as `min`; `Knob` and `XYPad` commit whenever a pointer gesture changed the value, even if it ends back on its starting value.
- 288d5f0: XY Pad takes a `name`: its two native inputs submit with a form as `name.x` and `name.y`, as the Knob and the Fader already do with their one.

### Patch Changes

- 889e175: Fix the package's types under `moduleResolution: "node16"` and `"nodenext"`: the published declarations imported each other without a file extension, which those settings cannot resolve. They now carry the extensions. The package passes `publint`, and `arethetypeswrong` finds no problem for any entry under its ESM-only profile. The README now introduces the package.
- 2c9116c: Fix `disabled` cursor feedback on Fader, Knob, and XYPad: `Root` now exposes `data-disabled` so the styled registry layer can put `cursor-not-allowed` on a wrapper that stays hoverable, instead of on the same `pointer-events-none` surface where it could never actually resolve.
- 6724811: Knob, XYPad, Envelope, Meter and Plot format numbers with a fixed language during server rendering and hydration, then with the browser's, so a page rendered on the server no longer hydrates with a different `aria-valuetext` (such as "1 000" against "1,000"). A `locale` prop still wins.
- 610df18: `Meter`'s parts are the package's own: `Meter.Channel` is the `role="meter"` with its `aria-valuenow`, `aria-valuetext` and `aria-labelledby`, `Meter.Label` names the channel it sits in, `Meter.Track`, `Meter.Indicator` and `Meter.Value` render as before. Their props and state types are now defined here. A `render` function on `Meter.Channel` and `Meter.Indicator` receives the channel's state (`clipping`, `warning`, `orientation`, `index`).
- 81f33f1: Every part renders and merges its props with the package's own code: the `render` prop (an element, or a function of the props and the state), the `data-*` attributes drawn from each part's state, and the chaining of event handlers, class names and styles all behave as before, but no longer come from another library. The size budgets count this code since it is now part of each entry.
- 8a34b12: - Ship with zero runtime dependencies: the few helpers previously pulled from `@audio-ui/utils` (declared as `"latest"`, so installs were not reproducible) are now bundled.
  - Fix `Knob` ignoring its documented default: without `defaultValue`, it now starts at, and double-tap resets to, the midpoint of `min…max` instead of `0`.
  - Set `touch-action: none` on the drag surfaces of `Knob`, `Fader`, `XYPad`, `Sequencer` and `Envelope` points, so touch drags no longer scroll the page when the primitives are used without the registry styles.
- ffe9c39: Parts that take focus when pressed (Knob, XYPad, Envelope points, Waveform control and regions, Timeline ruler and range handles, PianoRoll grid, notes and velocity bars, Piano keys) no longer show the keyboard focus ring for a pointer press: `:focus-visible` stays for keyboard focus.
- a26539d: Built on `@audio-ui/core`, which installs with it. The exports are unchanged: `createSource` and the `Source` types, still available from `@audio-ui/react` and `@audio-ui/react/source`, now come from the core.
- 20c47b4: Add `bun run size` to the package: it bundles each entry (React left out), gzips it and fails when it grows past its budget, so a primitive cannot get heavier unnoticed. XY Pad's tests now cover its state attributes, per-axis ranges and steps, the native inputs and its label.
- 4b8c30d: `Timeline.Viewport` adds up the wheel events that arrive within one frame and zooms once, so a trackpad sending several per frame no longer lays the timeline out several times; `Timeline.Lane` is laid out and styled apart from the rest of the page (`contain`), which makes each zoom step cheaper.
- Updated dependencies [a26539d]
  - @audio-ui/core@0.1.0

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
