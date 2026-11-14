# Transport

Starting, stopping and moving playback, and the loop. Times are positions on the arrangement, in seconds; the engine turns them into frames of the audio clock.

### TRN-001 Play and stop
Space starts playback at the start marker when stopped, and stops it when playing.
Test: apps/daw/test/transport.test.ts "TRN-001"

### TRN-002 Continue
Shift+Space starts playback where it last stopped, instead of at the start marker.
Test: apps/daw/test/transport.test.ts "TRN-002"

### TRN-003 The start marker
A click in a lane moves the start marker (and the cursor) there without starting playback. Home, or Fn+Left on a Mac keyboard, moves it to the start of the arrangement, and so does a second press of Stop while stopped.
Test: apps/daw/test/transport.test.ts "TRN-003"

### TRN-004 Playing from the ruler
A click in the ruler starts playback from the point clicked. While playing, a click jumps there.
Status: partial: the reference waits for the next boundary of the global quantization (one bar by default) and keeps the beat; the jump is immediate until OBS-007 settles where it lands.

### TRN-005 The loop
With the loop on, playback that reaches the loop's end goes on from its start: the frame after the last one of the loop is its first, with no gap and no overlap, whatever the loop's length in frames.
Test: packages/core/src/audio/playback/transport.test.ts "TRN-005"

### TRN-006 Starting past the loop
Playback started after the loop's end plays on and never loops. Started before its start, it plays into the loop and repeats it.
Test: packages/core/src/audio/playback/transport.test.ts "TRN-006"

### TRN-007 The loop from a selection
Cmd+L puts the loop around the time selection, or around the selected clips, and turns it on; with nothing selected it turns the loop on or off.
Test: apps/daw/test/browser/run.ts "TRN-007"

### TRN-008 The end of the arrangement
Playback stops at the end of the arrangement's length.
Deviation: the reference plays on past its last clip for as long as it is left running. The arrangement here has a length, which grows when a clip is laid past it, or when the clip view stretches a clip past it (its end dragged or typed, a loop played longer), in the same step of undo.
Test: apps/www/test/registry-audio/base/lib/arrangement-state.test.ts "TRN-008"; apps/daw/test/browser/run.ts "TRN-008"

### TRN-009 What you see is what you hear
The playhead is drawn where the sound that leaves the speakers is: the position of the audio clock less the output latency.
Test: packages/core/src/audio/playback/transport.test.ts "TRN-009"

### TRN-010 No click on a jump
A stop or a jump fades the sound that was playing out over 2 ms instead of cutting it, and after a jump the sound at the new place fades in over the same 2 ms. A start from a stop does not fade in, so playing or rendering from a stop stays neutral (CLP-001), and the loop's own wrap is not faded: it is seamless when the material is (TRN-005).
Test: packages/core/src/audio/playback/render.test.ts "TRN-010"

### TRN-011 Tails ring on
Stopping stops the clips and the notes; what effects are still sounding (a reverb, a delay) rings on.
Test: apps/daw/test/transport.test.ts "TRN-011"

### TRN-012 Tempo while playing
A change of tempo during playback keeps the bar and beat the playhead is on.
Test: packages/core/src/audio/playback/transport.test.ts "TRN-012"

### TRN-013 Position readout
The position reads in bars, beats and sixteenths, from 1, and in minutes and seconds.
Test: apps/daw/test/transport.test.ts "TRN-013"

### TRN-014 Follow
With Follow on, the view scrolls to keep the playhead in sight. It pauses on an edit or a scroll by hand, and comes back when playback starts or stops.
Test: apps/daw/test/transport.test.ts "TRN-014"

### TRN-016 Metronome
With the metronome on, a click sounds on each beat of the signature in force, or on the rhythm chosen, the first of a bar higher, in time with the sound whatever delay compensation holds it back, and through a loop. Turning it on or off, or changing its rhythm, while playing takes effect at the next click. It goes straight to the output, past the main fader and off its meter, and an export has none.
Test: packages/core/src/audio/time/metronome-clicks.test.ts; apps/www/test/browser/arrangement-engine.check.ts "TRN-016"; apps/daw/test/browser/run.ts "TRN-016"

### TRN-015 Start on time
Every track starts on the same frame: a play is scheduled a little ahead (the start latency, PRF-003) so each part of the engine has heard of it before its first frame.
Test: packages/core/src/audio/playback/transport.test.ts "TRN-015"
