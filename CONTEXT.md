# audio/ui

Accessible, composable audio UI components for React: headless primitives published as `@audio-ui/react`, plus a copy-paste registry of styled components built on them.

## Language

**Parameter**:
A bounded, stepped, continuously controllable value (gain, pan, playback position) that a control manipulates. Fader, Knob, and Transport each bind one parameter; XYPad binds two.
_Avoid_: value control, setting, param

**Taper**:
The curve mapping a parameter's normalized position to its value. All tapers are linear today; log/dB tapers (as on hardware faders) are anticipated but not implemented.
_Avoid_: curve, scale, easing

**Commit**:
The moment a gesture ends and the parameter's pending value becomes final. Distinct from the continuous updates streamed while the gesture is in flight.
_Avoid_: change (for gesture-end), submit

**Primitive**:
A headless, unstyled, accessible control published in `@audio-ui/react` (Fader, Knob, Transport, XYPad, ChannelStrip).
_Avoid_: component (when the headless building block is meant), widget

**Element**:
A styled registry wrapper over a primitive, copied into user projects via the registry. Adds appearance only — never behavior.
_Avoid_: styled component, wrapper

**PlaybackEngine**:
The seam between the audio-store (domain: queue, playback intent) and a concrete audio backend. Commands flow in (load, play, pause, seek, setVolume…), events flow out (play, pause, timeupdate, ended, error…) through one interface — no caller reaches past it into a raw `HTMLAudioElement`. `HtmlAudioEngine` is the production adapter; a `FakeEngine` is the in-memory test adapter.
_Avoid_: audio engine (ambiguous with Web Audio), device, backend

**Category**:
A curated, editorial grouping of catalog items (label, description, SEO, its own page). Declared in `categories.ts`; counts are derived, never hand-written.
_Avoid_: tag (for a curated grouping), section

**Tag**:
A free-form search label carried by a catalog item (e.g. `ui`, `grid`). Not a category: no page, no count, no SEO.
_Avoid_: category (for a free-form label)
