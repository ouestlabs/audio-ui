---
"@audio-ui/engine": patch
---

Files, repair: `repairChannels`, `stretchChannels` and `filterChannels` throw a `RangeError` that names the repair, method or filter type they do not know. Before, an unknown name failed as a call of `undefined`, and a name every object inherits, such as `"constructor"`, ran that inherited function.
