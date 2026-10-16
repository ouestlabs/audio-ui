---
"@audio-ui/core": patch
---

Device tools: when a `<id>_set` call gives only values that are already set, the sentence it returns says so ("Nothing changed: every value given is already set.") instead of "Nothing changed.", so a model reading it back knows the call worked and was a no-op.
