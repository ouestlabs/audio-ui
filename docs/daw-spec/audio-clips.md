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
A clip laid down gets a fade of 4 ms at each edge (or half its length when shorter), which can be edited, and a cut gives an audio clip one each side of it. Delete or Backspace on a fade's handle sets it back to 4 ms; dragged to nothing, it stays at nothing. It applies to clips made from now on: a project already saved keeps its fades.
Test: apps/www/test/registry-audio/base/lib/arrangement-state.test.ts "CLP-006"; apps/daw/test/browser/run.ts "CLP-006"

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
In Beats or Tones, a clip plays `transpose` semitones from its pitch, at the speed its warp gives it. In Repitch the transpose does nothing: its speed is its pitch.
Test: packages/core/src/audio/playback/render.test.ts "CLP-013"

### CLP-014 Crossfades
Two clips that meet on a track with fades of one length play through each other: each goes on past the join by as much as both sources hold, up to that length, and both fade over the same stretch around it, along their shapes. With a shape whose two sides add up to one, such as linear, what they share stays level, and a clip cut in two plays on as if it were whole. Dragging a fade between two clips that meet gives both that length. With fades of different lengths, or nothing to play past the join, each keeps its own fade, down to silence at the join. In a `.dawproject` file they go out as the fades they are.
Test: apps/www/test/browser/arrangement-engine.check.ts "CLP-014"

### CLP-015 Warp modes
A clip plays in one of three warp modes. Repitch keeps the speed and the pitch together (CLP-009), and is what a clip with no mode plays. Beats and Tones keep the pitch whatever the speed. A clip with no warp and no transpose is copied as it is in any mode (CLP-001).
Test: packages/core/src/audio/playback/render.test.ts "CLP-015"

### CLP-016 Beats
Beats plays slices of the recording, a sixteenth note long by default, each at its own speed from where the warp places its start: what a slice holds, such as a drum's attack, sounds as it was recorded. Slowed down, a slice stops where the next begins; sped up, it is cut. The next slice crosses in just before its start, so an attack on its start is at full level. Where a slice falls is worked out from its frame alone, so a jump, a loop and an export all play the same.
Test: packages/core/src/audio/playback/render.test.ts "CLP-016"

### CLP-017 Tones
Tones plays grains that overlap, each lined up on the sound of the one before it, so a held note keeps its pitch and its level. The lining up goes grain by grain from the clip's start or from where playback began: an export from its start is the same every time, and a play from the middle can differ from it in phase, not in pitch or time.
Test: packages/core/src/audio/playback/render.test.ts "CLP-017"

### CLP-018 Transients and tempo
A recording's transients are where its notes and beats begin: frames where its level rises sharply, found to the sample. Its tempo is the beat period its transients repeat at most strongly, between 60 and 200 BPM, the octave nearest 120 BPM when two fit; the first beat is where that beat falls first. A recording with no steady beat (noise, a single hit) has no tempo.
Test: packages/core/src/audio/analysis/tempo.test.ts "CLP-018"

### CLP-019 Warp on import
A file dropped in is warped in Beats when its tempo can be told, so it plays in time at the arrangement's. A short file taken as a well-cut loop of 1, 2, 4, 8 or 16 bars (one of them gives a tempo within 4 % of the estimate, or of its double or half) takes the tempo its length gives, with a warp marker at its start and one at its end. Any other gets a marker on the first beat of each bar, each moved onto the transient within an eighth of a beat of it, and the clip starts on its first beat. A file with no tempo plays as recorded.
Deviation: the reference also warps files it reads as one-shots, and lets a preference turn warping on import off; here a file with no tempo is not warped, and there is no preference yet.
Test: packages/core/src/audio/analysis/tempo.test.ts "CLP-019"; apps/daw/test/drop.test.ts "CLP-019"

### CLP-020 A waveform at any zoom
An audio clip's waveform on its track has a column per pixel of the screen at any zoom, with no gaps between them, and shows the recording to one slice per pixel at the closest zoom, each column from its lowest sample to its highest, so a lopsided sound shows lopsided. It draws only what the view shows, so a zoom or a scroll costs the same whatever the clip's length. The clip view draws its source the same way, and both follow a zoom in the frame it happens, not once it stops.
Test: apps/www/test/registry-audio/base/lib/arrangement.test.ts "CLP-020"; apps/daw/test/project-file.test.ts "CLP-020"; apps/daw/test/browser/run.ts "CLP-020"

### CLP-021 The source in the clip view
Under the clip view's ruler, a range holds what the clip plays of its source, or its loop: two handles to drag, and the range itself to move it. It has no fill of its own: the waveform dims outside it, so what plays shows on the sound itself. Warp markers lying closer than a handle's room, on average, show as ticks along the top of the waveform, and zooming in brings their handles and lines back.
Test: apps/www/test/registry-audio/base/audio/clip-panel.test.ts "CLP-021"; apps/daw/test/browser/run.ts "CLP-021"

### CLP-022 Folding a clip box
A press anywhere on the heading of a foldable box of the clip view folds it to a narrow strip, and a press anywhere on the strip unfolds it: the caret shows the way, it is not the only place to aim at.
Test: apps/daw/test/browser/run.ts "CLP-022"
