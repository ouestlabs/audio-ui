---
"@audio-ui/react": patch
---

Add `bun run size` to the package: it bundles each entry (React left out), gzips it and fails when it grows past its budget, so a primitive cannot get heavier unnoticed. XY Pad's tests now cover its state attributes, per-axis ranges and steps, the native inputs and its label.
