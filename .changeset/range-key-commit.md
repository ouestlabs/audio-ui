---
"@audio-ui/core": patch
---

Timeline range: a move by the keyboard commits the range it just made, so a view that redraws it from its own props while the change is reported no longer commits the old one.
