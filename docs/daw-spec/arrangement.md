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

### ARR-010 Moving a track
A track moves up or down the arrangement by its grip, dragged or with Up and Down on it: a copy of its header follows the pointer, a line marks the gap it would land in, and the view scrolls at its edges. The return tracks stay under the tracks. One step of undo.
Test: apps/daw/test/browser/run.ts "ARR-010"

### ARR-011 A track's height
A track shares the height of the view with the others until its edge is dragged, or moved with Up and Down, from its least height to its greatest: it keeps that height, and the others share what is left. When they no longer fit, the view scrolls.
Test: apps/daw/test/browser/run.ts "ARR-011"

### ARR-012 Folding a track
A track folds to a strip by the caret in its header, or with U on the selected tracks; Option+U unfolds them all. What it holds still plays.
Test: apps/daw/test/browser/run.ts "ARR-012"

### ARR-013 Automation
A shows or hides the automation: each track's lane draws the envelope of its volume or its pan, chosen in its header, over its clips. A double-click adds a point, a drag moves one, and what is drawn is what plays. A volume or a pan moved by hand stops following its envelope and plays the value it was moved to, drawn greyed, until "Re-enable automation", or until that envelope is drawn again.
Test: apps/www/test/registry-audio/base/hooks/use-track-automation.test.tsx; apps/daw/test/browser/run.ts "ARR-013"

### ARR-014 Selecting time
A drag across bare lanes selects a stretch of time, from the track it began on to the track under the pointer, on the grid when it snaps. Cmd+C and Cmd+X copy and cut it (the selected clips with no time selected), Cmd+V pastes at the cursor, Cmd+D puts it again right after itself and moves the selection onto the copy, Cmd+J makes one clip per track of it, Delete empties it. With Shift too, Cmd+X, Cmd+V, Cmd+D and Delete work on the time itself, on every track. Each is one step of undo. Cmd+Option+F makes fades from it. A press on bare lane, picking a clip or Escape lets go of it.
Test: apps/www/test/registry-audio/base/hooks/use-time-selection.test.tsx; apps/daw/test/browser/run.ts "ARR-014"

### ARR-015 Selecting clips with a rectangle
Shift and a drag across bare lane draws a rectangle: the clips it touches join the selection.
Test: apps/daw/test/browser/run.ts "ARR-015"
