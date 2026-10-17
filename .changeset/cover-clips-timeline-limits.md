---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

Timeline: `coverClips`, `copyRange`, `removeTime` and `insertTime` take only the timeline's length, `{ duration }`, as their limits. A source's length limits how far one clip stretches, yet handing one to these functions cut every clip they touched down to the length of that single source, so a clip laid over another could leave a gap, and a looped clip longer than its source was cut back to it. They now read `duration` alone, and a call that passes `sourceLength` in an object literal no longer type-checks: drop it.
