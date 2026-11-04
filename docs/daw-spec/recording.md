# Recording

How sound and notes played into the DAW become clips of the arrangement. There is no session view: everything here records into the arrangement.

### REC-001 Arm
Each audio and MIDI track has an Arm button. Arming a track disarms the others, unless Cmd / Ctrl is held; arming selects the track. A group or return track cannot be armed.
Status: planned (phase 6).

### REC-002 Inputs
An audio track records from an audio input of the browser (the default one until another is picked in its input menu), in stereo, or in mono from its first channel when the input has one. A MIDI track records from every MIDI input the browser offers, and from the computer keyboard while it plays notes (two octaves from A, as the piano roll's keys).
Status: planned (phase 6).

### REC-003 Monitoring
A track's monitor is Auto, the default, or Off. On Auto, an armed audio track sends its input through its devices to its strip, and an armed MIDI track plays what comes in on its instrument; Off, it records without playing it. A disarmed track never monitors.
Status: planned (phase 6).

### REC-004 Record
The Record button (F9) starts playback, from the cursor, and records on every armed track; pressed again, or Stop, ends the take. With no track armed it records nothing and plays.
Status: planned (phase 6).

### REC-005 Count-in
A count-in of None (the default), 1, 2 or 4 bars plays the metronome from that many bars before the cursor, and the take starts at the cursor. The transport shows the count-in as negative bars.
Status: planned (phase 6).

### REC-006 Punch
With Punch on, a take keeps only what falls inside the loop: playback may start before it, as a pre-roll, and recording stops at its end.
Status: planned (phase 6).

### REC-007 An audio take
An audio take becomes one clip from where it started to where it stopped, over the clips under it on its track, which are cut away there. Its recording is saved with the project as a WAV file, as a dropped file is, and streamed like any other.
Status: planned (phase 6).

### REC-008 Latency
An audio take is moved earlier by the input's latency plus the output's, as the browser reports them, so what was played lines up with what was heard while playing it.
Status: planned (phase 6).

### REC-009 A MIDI take
A MIDI take becomes one clip of the notes played, each where and as long as it was held, with its velocity. With Overdub on, notes recorded over a MIDI clip are added to it rather than replacing it. Record quantization (None, the default, or 1/4, 1/8, 1/16, 1/32) moves each note's start to the grid as it is recorded.
Status: planned (phase 6).

### REC-010 Undo
One undo takes a whole take away, with the clips it cut; one redo brings it back.
Status: planned (phase 6).

Deviation: no capture of what was played while not recording, no take lanes, and a take recorded in a loop keeps its last pass only.
