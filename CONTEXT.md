# audio/ui

Accessible, composable audio UI components for React: headless primitives published as `@audio-ui/react`, plus a copy-paste registry of styled components built on them.

## Language

**Parameter**:
A bounded, stepped, continuously controllable value (gain, pan, playback position) that a control manipulates. Fader, Knob, and Transport each bind one parameter; XYPad binds two.
_Avoid_: value control, setting, param

**Device**:
An effect or an instrument as a set of named Parameters, with no interface and no audio in it (`defineDevice` in `@audio-ui/core/device`). Its **state** is a plain object keyed by parameter id (numbers and booleans), a value a host stores and saves. One description feeds a panel, an engine adapter and an agent, so none of them redefines a range. Its id is stable and reverse-DNS (`audioui.compressor`): a project stores that, not the panel that draws it.
_Avoid_: plugin (a Device is a description, not a package), module, processor

**Parameter Descriptor**:
What a Device says about one Parameter: id, label, range, step, Taper, unit, default. A toggle is a parameter with a boolean value.
_Avoid_: schema, config

**Taper**:
The curve mapping a parameter's normalized position to its value. All tapers are linear today; log/dB tapers (as on hardware faders) are anticipated but not implemented.
_Avoid_: curve, scale, easing

**Commit**:
The moment a gesture ends and the parameter's pending value becomes final. Distinct from the continuous updates streamed while the gesture is in flight.
_Avoid_: change (for gesture-end), submit

**Primitive**:
A headless, unstyled, accessible control published in `@audio-ui/react` (Envelope, Fader, Knob, Meter, Pad, Piano, PianoRoll, Plot, Sequencer, Timeline, Waveform, XYPad), its framework-free logic in `@audio-ui/core`.
_Avoid_: component (when the headless building block is meant), widget

**Element**:
A styled registry wrapper over a primitive, copied into user projects via the registry. Adds appearance only, never behavior.
_Avoid_: styled component, wrapper

**TransportClock**:
The seam between musical time (tempo, steps, loop region, seek) and Web Audio scheduling. A drift-free look-ahead clock: it advances a stepping cursor against `AudioContext.currentTime` and emits `(step, audioTime)` boundaries so a caller schedules synthesis sample-accurately, and it exposes a continuous playhead position, but it knows nothing about *what* is played (drum hits, note-pairs). It owns start/stop/seek/region and fires a reset on every re-anchor so the caller can flush its scheduled-ahead sound. `use-transport-clock` is a thin adapter over its pure, framework-agnostic core in `lib/lookahead-scheduler.ts`.
_Avoid_: scheduler (bare: say the core or the clock), timer, metronome

**Category**:
A curated, editorial grouping of catalog items (label, description, SEO, its own page). Declared in `categories.ts`; counts are derived, never hand-written.
_Avoid_: tag (for a curated grouping), section

**Tag**:
A free-form search label carried by a catalog item (e.g. `ui`, `grid`). Not a category: no page, no count, no SEO.
_Avoid_: category (for a free-form label)
