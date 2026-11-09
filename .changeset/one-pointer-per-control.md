---
"@audio-ui/core": patch
---

Knob, Fader, XYPad, Envelope, Sequencer, PianoRoll, Waveform, Plot and Timeline: while one finger drags a control, a second finger pressed on it is ignored, so it can't take the drag over. A second finger used to freeze a knob under the first, or drop the note a piano roll was moving. The same pointer pressing again still starts afresh, so a release the page missed never leaves a control dead. Fader: a finger lifted somewhere else no longer ends its drag.
