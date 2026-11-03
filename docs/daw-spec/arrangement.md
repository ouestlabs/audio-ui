# Arrangement playback

The arrangement plays what is laid out on its tracks. Editing commands (split, consolidate, time selections) are in the editing chapter (phase 3); this one is what playback does with them.

### ARR-001 A clip plays where it lies
A clip that starts at a time on the arrangement plays its first frame at the frame nearest that time on the audio clock, and lasts its length to the frame.
Test: packages/core/src/audio/playback/render.test.ts "ARR-001"

### ARR-002 Deactivated clips are silent
A deactivated clip (key 0) stays on its track, drawn faded, and plays nothing.
Test: packages/core/src/audio/playback/render.test.ts "ARR-002"

### ARR-003 A split is seamless
Splitting a clip anywhere changes nothing in what plays: the two pieces render the same frames as the clip did.
Test: packages/core/src/audio/playback/render.test.ts "ARR-003"

### ARR-004 Edits while playing
Adding, moving, trimming or removing a clip while playing changes what plays within one render quantum of the engine receiving it, without stopping or restarting playback.
Test: apps/daw/test/arrangement.test.ts "ARR-004"

### ARR-005 Files dropped on a track
Audio files dropped on an audio track become one clip each, laid one after the other from the time under the pointer (snapped to the grid when snapping is on). A clip takes its file's name, without the extension.
Status: partial: OBS-001 settles whether the reference lays several files after each other or on tracks of their own, and what a modifier key changes.
Test: apps/daw/test/arrangement.test.ts "ARR-005"

### ARR-006 Files dropped on the add-track row
Audio files dropped on the row that adds a track make one new audio track per file, named after it (without the extension), each holding its file as a clip from the time under the pointer.
Test: apps/daw/test/arrangement.test.ts "ARR-006"

### ARR-007 What cannot be read
A dropped file that is not sound, or that the browser cannot decode, is left out, and the app says which.
Test: apps/daw/test/arrangement.test.ts "ARR-007"

### ARR-008 Clips keep their recording
A clip names the recording it plays; splitting, duplicating or copying it keeps that name, so every piece plays the same recording.
Test: apps/www/test/arrangement-state.test.ts "ARR-008"

### ARR-009 Tracks in a new project
A new project holds two audio tracks, two MIDI tracks and two return tracks, the first with a reverb, the second with a delay, at 120 BPM in 4/4.
Status: partial: OBS-013 checks the reference's default.
Test: apps/daw/test/project.test.ts "ARR-009"
