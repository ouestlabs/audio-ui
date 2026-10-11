---
"@audio-ui/react": patch
---

Fix the package's types under `moduleResolution: "node16"` and `"nodenext"`: the published declarations imported each other without a file extension, which those settings cannot resolve. They now carry the extensions, and the package passes `publint` and `arethetypeswrong` for every entry. The README is now a real introduction.
