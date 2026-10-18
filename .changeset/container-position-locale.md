---
"@audio-ui/react": patch
---

Fader, Knob, XYPad, Meter and Waveform: the control that holds their absolutely placed parts (a mark, a thumb, a hover) is `position: relative` by default, so those parts no longer land on the page when a project has no CSS for the control. A formatting locale the platform reports as a POSIX tag (`en-US@posix`) falls back to `en-US` instead of throwing during the render.
