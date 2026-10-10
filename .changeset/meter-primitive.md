---
"@audio-ui/react": minor
---

Add the Meter primitive: a multi-channel level meter (stereo output, channel strips, any multi-channel source). Display only — there is nothing to control.

- Parts: `Root` (the group), `Channels` (one child per channel), `Channel` (a `role="meter"`), `Track`, `Indicator` (the lit part), `Peak` (the peak-hold mark), `Value` (the formatted level) and `Label`. Channel parts expose `data-orientation` and `data-clipping` (at or above `clipThreshold`).
- Levels come from `value` / `peak` props, or from a live `source` (`{ getSnapshot, subscribe }`, the shape of an external store). With a source the meter writes each frame straight to the DOM, so a signal updating 60 times a second never re-renders React; only a change in channel count does.
- Each channel announces its level as a number (`format` / `locale`, one decimal by default), not as a share of the range; add the unit with `getAriaValueText`, e.g. `"-6 dB"`. Name channels with `aria-label` or `Meter.Label`.
- Peak-hold timing and decay stay outside the primitive: the meter has no clock.
