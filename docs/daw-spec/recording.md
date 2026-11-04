# Recording

How sound and notes played into the DAW become clips of the arrangement. There is no session view: everything here records into the arrangement.

### REC-001 Arm
Each audio and MIDI track has an Arm button. Arming a track disarms the others, unless Cmd / Ctrl is held; arming selects the track. A group or return track cannot be armed.
Test: apps/daw/test/browser/run.ts "REC-004"

### REC-002 Inputs
An audio track records from an audio input of the browser (the default one until another is picked in its input menu), in stereo, or in mono from its first channel when the input has one. A MIDI track records from every MIDI input the browser offers, and from the computer keyboard while it plays notes (two octaves from A, as the piano roll's keys).
Status: partial: the default audio input only, and MIDI from the browser's inputs; no input menu, no computer keyboard yet.

### REC-003 Monitoring
An armed MIDI track plays what comes in on its instrument, through its devices. An armed audio track records its input without playing it.
Deviation: the reference monitors an armed audio track by default; through a laptop's speakers a microphone would feed back, so here it is not, until a monitor choice comes with a headphones setting.
Status: done for MIDI (by hand: a MIDI input cannot be driven from a check).

### REC-004 Record
The Record button (F9) starts playback, from the cursor, and records on every armed track; pressed again, or Stop, ends the take. With no track armed it records nothing and plays.
Test: apps/daw/test/browser/run.ts "REC-004"

### REC-005 Count-in
A count-in of None (the default), 1, 2 or 4 bars plays the metronome from that many bars before the cursor, and the take starts at the cursor. The transport shows the count-in as negative bars.
Status: partial: the count-in clicks before the take, and the transport does not show negative bars.

### REC-006 Punch
With the loop on, a take keeps its first pass, up to the loop's end. With Punch on too, it keeps only what falls inside the loop: playback may start before it, as a pre-roll.
Test: by hand; the range is `takeRange` in apps/daw/src/components/daw/use-take.ts.

### REC-007 An audio take
An audio take becomes one clip from where it started to where it stopped, over the clips under it on its track, which are cut away there. Its recording is saved with the project as a WAV file, as a dropped file is, and streamed like any other.
Test: apps/www/test/registry-audio/base/lib/recording.test.ts "REC-007"; apps/daw/test/browser/run.ts "REC-004"

### REC-008 Latency
An audio take is moved earlier by the input's latency plus the output's, as the browser reports them, so what was played lines up with what was heard while playing it.
Test: apps/www/test/registry-audio/base/lib/recording.test.ts "REC-008"

### REC-009 A MIDI take
A MIDI take becomes one clip of the notes played, each where and as long as it was held, with its velocity. With Overdub on, notes recorded over a MIDI clip are added to it rather than replacing it. Record quantization (None, the default, or 1/4, 1/8, 1/16, 1/32) moves each note's start to the grid as it is recorded.
Test: apps/www/test/registry-audio/base/lib/recording.test.ts "REC-009"
Status: partial: Overdub and record quantization are in the lib, not yet in the DAW's menus.

### REC-010 Undo
One undo takes a whole take away, with the clips it cut; one redo brings it back.
Test: apps/daw/test/browser/run.ts "REC-004"

### REC-011 A take drawn as it records
While a take records, each of its tracks shows it as a red clip from where it started to the playhead, growing as playback moves, an audio take's sound drawn as it comes in.
Test: apps/daw/test/browser/run.ts "REC-004"; apps/www/test/registry-audio/base/lib/recording.test.ts "REC-011"

Deviation: no capture of what was played while not recording, no take lanes, and a take recorded with the loop on keeps its first pass.
