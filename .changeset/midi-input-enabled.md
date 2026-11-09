---
"@audio-ui/core": minor
---

MIDI input: `setInputEnabled(name, enabled)` switches one device off, so its messages are not heard, or on again, and the state lists the devices switched off in `muted`. The choice holds before the device connects and while it is unplugged.
