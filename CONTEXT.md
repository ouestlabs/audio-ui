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
