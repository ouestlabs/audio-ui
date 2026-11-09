---
"@audio-ui/core": patch
---

MIDI input: a `disconnect()` made while the browser still asks for access now holds once access is granted, and of two `connect()` calls made at once, only the last one is listened to. The answer to the earlier request used to connect the devices again.
