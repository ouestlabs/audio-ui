---
"@audio-ui/core": patch
---

Knob, Fader, XYPad, Envelope, Sequencer, PianoRoll, Waveform, Plot and Timeline: pressed again after a release the page missed (the button let go outside the window or over a menu), a control ends the drag it was in, committing it, before it starts the new one. It used to follow that pointer twice: a knob turned at twice the speed, and a fader committed its drag twice.
