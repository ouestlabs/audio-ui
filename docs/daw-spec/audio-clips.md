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
A recording's transients are where its notes and beats begin: frames where its level rises sharply, found to the sample. Its tempo is read from how its onsets repeat (spectral flux, a comb of tempos from 60 to 200 BPM), then the beat grid is fitted on its transients, to a hundredth of a BPM, with the first beat where it falls. A recording with no attack (silence, noise, a single hit) has no tempo. Measured on 2026-11-09 on 27 drum grooves of human drummers played to a click (Groove MIDI Dataset) and 3 loops: 24 read at their tempo, 6 at its double or half, none wrong; the transients alone found no tempo in 19 of them.
Test: packages/core/src/audio/analysis/beat.test.ts (transients), apps/www/test/registry-audio/base/lib/arrangement.test.ts "CLP-018"

### CLP-019 Warp on import
A file dropped in is warped in Beats when its tempo can be told, so it plays in time at the arrangement's. A short file taken as a well-cut loop of 1, 2, 4, 8 or 16 bars (one of them gives a tempo within 4 % of the estimate, or of its double or half) takes the tempo its length gives, with a warp marker at its start and one at its end. Any other gets a marker on the first beat of each bar, each moved onto the transient within an eighth of a beat of it, and the clip starts on its first beat. A file with no tempo plays as recorded. Warp files on import, in the Record settings and on by default, turns this off: every dropped file then plays as recorded, as a voice or an ambience would want.
Deviation: the reference also warps files it reads as one-shots; here a single hit has no tempo and plays as recorded.
Test: packages/core/src/audio/analysis/beat.test.ts (autoWarp); apps/daw/test/drop.test.ts "CLP-019"; apps/daw/test/browser/run.ts "CLP-019"

### CLP-020 A waveform at any zoom
An audio clip's waveform on its track has a column per pixel of the screen at any zoom, with no gaps between them, and shows the recording to one slice per pixel at the closest zoom, each column from its lowest sample to its highest, so a lopsided sound shows lopsided. Each column is joined to the next, and a column narrower than a peak takes the level between the two peaks around it, so a close zoom draws slopes, never steps. It draws only what the view shows, so a zoom or a scroll costs the same whatever the clip's length. The clip view draws its source the same way, and both follow a zoom in the frame it happens, not once it stops.
Test: apps/www/test/registry-audio/base/lib/arrangement.test.ts "CLP-020"; apps/daw/test/project-file.test.ts "CLP-020"; apps/daw/test/browser/run.ts "CLP-020"

### CLP-021 The source in the clip view
Under the clip view's ruler, a range holds what the clip plays of its source, or its loop: two handles to drag, and the range itself to move it. It has no fill of its own: the waveform dims outside it, so what plays shows on the sound itself. Warp markers lying closer than a handle's room, on average, show as ticks along the top of the waveform, and zooming in brings their handles and lines back.
Test: apps/www/test/registry-audio/base/audio/clip-panel.test.ts "CLP-021"; apps/daw/test/browser/run.ts "CLP-021"

### CLP-022 Folding a clip box
A press anywhere on the heading of a foldable box of the clip view folds it to a narrow strip, and a press anywhere on the strip unfolds it: the caret shows the way, it is not the only place to aim at.
Test: apps/daw/test/browser/run.ts "CLP-022"

### CLP-023 Fade handles
A clip's fade handles sit at the top corners of its body, under its name, and its fades are drawn over its body alone: neither hides a letter of its name.
Test: apps/daw/test/browser/run.ts "CLP-023"

### CLP-024 Samples up close
The clip view zooms in past the detail of a recording's peaks, down to 40 px between two samples: closer than the peaks, each column of the waveform spans its lowest and highest sample, and past one sample per pixel the waveform is a line through the samples, with a dot on each one that grows in from 6 px apart to 12. It reads the samples around what the view shows, from memory or from the recording's cache file, keeps them, and reads them ahead as the zoom nears them, so a zoom or a scroll draws in the frame it happens, never the peaks first and the samples after. The source's lane is never laid out wider than 16 million px, so a long recording stops short of the closest zoom.
A stereo recording is drawn a row a channel once the rows are 40 px tall, as the reference draws it, and as the middle of the two, (L + R) / 2, below that.
Test: apps/www/test/registry-audio/base/lib/arrangement.test.ts "CLP-024"; apps/daw/test/samples.test.ts "CLP-024"; apps/daw/test/browser/run.ts "CLP-024"

### CLP-025 A streamed recording on the GPU
A recording streamed from its cache file is drawn on the GPU without being read whole: its leaves, the lowest and highest sample, the sum of squares and the count of every 256 frames, of its mix, each channel and its three bands, are made as it is written and kept beside it (`cache/<id>.leaves`), or made once from its samples for a cache made before them. Zoomed out the waveform is drawn from them; once a leaf is wider than a device pixel the view reads the frames it shows, 65536 at a time, and lets go of the oldest it no longer shows.
Test: apps/daw/test/samples.test.ts "CLP-025"; apps/daw/test/browser/run.ts "CLP-025"

### CLP-026 The source's views
The clip view's View menu, in its strip after the clip's name, draws the source as its waveform, its waveform by band (the lows warm behind, the highs cool in front, each as tall as its own loudest), or its spectrogram on octaves, mel, ERB or hertz, with its frequency axis and the frequency and level under the pointer; the view stays from clip to clip and across a reload. A streamed recording's spectrogram is drawn from its spectra, made once in a worker and kept beside it (`cache/<id>.spectra`), and its bands are split as the view reads them, from a few thousand frames before. A reversed clip is drawn as its waveform.
Test: apps/daw/test/samples.test.ts "CLP-026"; apps/daw/test/browser/run.ts "CLP-026"
