---
"@audio-ui/react": patch
---

Fix the package's types under `moduleResolution: "node16"` and `"nodenext"`: the published declarations imported each other without a file extension, which those settings cannot resolve. They now carry the extensions. The package passes `publint`, and `arethetypeswrong` finds no problem for any entry under its ESM-only profile. The README now introduces the package.
