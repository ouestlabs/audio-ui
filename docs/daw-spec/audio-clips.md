# Audio clips

How an audio clip turns its recording into frames: which frames of the recording, at what gain. The warp modes that stretch time without changing pitch are phase 4; this chapter holds the repitch mode, where speed and pitch change together.

### CLP-001 Neutral playback
A clip at 0 dB with no fade, not stretched, whose recording is at the engine's sample rate, played through a track at unity and centre, comes out bit-identical to its recording.
Test: packages/core/src/audio/playback/render.test.ts "CLP-001"

### CLP-002 Gain
The clip's gain, in dB, multiplies each of its frames by 10^(gain/20).
Status: partial: OBS-002 gives the reference's range and default; the clip panel allows -36 to +24 dB today.
Test: packages/core/src/audio/playback/render.test.ts "CLP-002"

### CLP-003 Fade-in
From the clip's start, over its fade-in length, the gain rises from 0 to 1 along the fade's shape (linear, fast, slow or smooth). The first frame of a fade-in is silent.
Test: packages/core/src/audio/playback/render.test.ts "CLP-003"

### CLP-004 Fade-out
Over the clip's fade-out length, up to its end, the gain falls from 1 to 0 along the shape, the curve of the fade-in played backwards.
Test: packages/core/src/audio/playback/render.test.ts "CLP-004"

### CLP-005 Fades fit
A fade-in and a fade-out never overlap: together they are as long as the clip at most.
Test: packages/core/src/primitives/timeline/test/clip.test.ts (fitFades)

### CLP-006 Fades on clip edges
A clip laid down gets a fade of 4 ms at each edge (or half its length when shorter), which can be edited, and a cut gives an audio clip one each side of it. It applies to clips made from now on: a project already saved keeps its fades.
Test: apps/www/test/registry-audio/base/lib/arrangement-state.test.ts "CLP-006"
Status: partial: a fade deleted does not go back to 4 ms.

### CLP-007 Loop
A looped clip plays from where it starts in its recording to the loop's end, then the loop again and again, for as long as the clip lasts. Each pass starts on the frame after the last one of the pass before.
Test: packages/core/src/audio/playback/render.test.ts "CLP-007"

### CLP-008 Reverse
A reversed clip plays the same stretch of its recording, backwards: its region and its loop are mirrored onto the reversed recording, so what it played from first it now plays last.
Test: packages/core/src/audio/playback/render.test.ts "CLP-008" (the mirror), apps/www/test/registry-audio/base/audio/clip-panel.test.ts "CLP-008" (the region and the loop)

### CLP-009 Repitch
Between two warp markers, the recording plays at the speed that takes it from one to the other, and its pitch moves with the speed: twice as fast is an octave up. Past the first and the last marker it keeps the speed of the stretch next to it.
Test: packages/core/src/audio/playback/render.test.ts "CLP-009"

### CLP-010 Interpolation
A clip played at a speed other than 1, or from between two frames, reads its recording through an interpolator. Frames read at speed 1 on whole frames are copied as they are (CLP-001).
Test: packages/core/src/audio/playback/render.test.ts "CLP-010"

### CLP-011 Recordings at another sample rate
A recording at another sample rate than the engine's is converted to the engine's when it is decoded. The conversion is not neutral.
Test: apps/daw/test/arrangement.test.ts "CLP-011"

### CLP-012 Mono recordings
A mono recording plays at full level in both channels: a track's chain is always stereo.
Test: packages/core/src/audio/playback/render.test.ts "CLP-012"

### CLP-013 Transpose
Transposing an audio clip without changing its speed needs a warp mode that stretches time.
Status: planned (phase 4). In repitch mode the transpose is disabled, as in the reference.

### CLP-014 Crossfades
Two clips that meet on a track with fades of one length play through each other: each goes on past the join by as much as both sources hold, up to that length, and both fade over the same stretch around it, along their shapes. With a shape whose two sides add up to one, such as linear, what they share stays level, and a clip cut in two plays on as if it were whole. Dragging a fade between two clips that meet gives both that length. With fades of different lengths, or nothing to play past the join, each keeps its own fade, down to silence at the join. In a `.dawproject` file they go out as the fades they are.
Test: apps/www/test/browser/arrangement-engine.check.ts "CLP-014"
