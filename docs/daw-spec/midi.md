# MIDI playback

How the notes of MIDI clips reach the instruments. Editing notes is the piano roll's, already in the registry; this chapter is what playback does with them.

### MID-001 Notes go to the track's instrument
Each MIDI track plays its notes through the instrument of its device chain. A MIDI track with no instrument plays nothing.
Test: apps/daw/test/midi.test.ts "MID-001"

### MID-007 The roll's keyboard
The keys down the side of the piano roll are black and white, and a pressed key takes the accent color, the pointer still over it.
Test: apps/www/test/style-rules.test.ts; apps/daw/test/browser/run.ts "MID-007"

### MID-008 MIDI files and scores dropped
A MIDI file, or a MusicXML score (`.musicxml`, `.xml`, or compressed as `.mxl`), dropped on the button that adds a track makes a MIDI track for each part, named after it (after its file, when it has one part), with the instrument nearest its General MIDI program: a drum rack for channel 10, the Pocket Synth for a part with no program. Its notes make a clip from the start of the arrangement, in beats at the arrangement's tempo, so they sit on its grid, and the clip lasts whole bars. Dropped on a MIDI track, each file is one clip of all its parts, at the time under the pointer, one after the other. Dropped on an audio track, nothing is laid, and a notice says it goes on a MIDI track. MIDI files are read by `@audio/midi-parse`, scores by `@audio/musicxml`.
Test: apps/daw/test/scores.test.ts "MID-008"; apps/daw/test/browser/run.ts "MID-008"

### MID-009 Importing from the menu
Import MIDI or MusicXML…, in the project's menu, takes one or more files and lays them as on the button that adds a track, from the cursor.
Test: apps/daw/test/browser/run.ts "MID-009"

### MID-002 On time
A note starts at the frame of the audio clock where it lies on the arrangement, and ends at the frame of its end, scheduled ahead on the same transport as the audio clips (TRN-015), so a note and an audio clip that start together start on the same frame.
Test: packages/core/src/audio/playback/transport.test.ts "MID-002"

### MID-003 Chase
Playback started inside a note plays that note from there to its end.
Test: apps/www/test/arrangement-playback.test.ts "MID-003"

### MID-004 Notes that do not play
A muted note, or one of a deactivated clip, plays nothing. A note's chance is rolled once per pass, and its velocity strays by its deviation.
Test: apps/www/test/arrangement-playback.test.ts "MID-004"

### MID-005 Stop and jump release the notes
A stop or a jump ends every sounding note at once, through its instrument's release.
Test: apps/www/test/arrangement-playback.test.ts "MID-005"

### MID-006 Looped MIDI clips
A looped MIDI clip plays the notes of its loop on every pass, each pass on the arrangement's frames.
Test: apps/www/test/arrangement.test.ts (playedNotes)

### MID-010 A clip's scale
A MIDI clip's Scale menu, in the bar over its notes, picks a root and a scale and turns it on: on, the roll marks the scale's rows and Fold keeps those rows as well as the ones with notes. Its menu offers the three keys the song is likeliest in, read from every MIDI clip but the drums' and from the sound of every audio clip, moved by its transposition: one picked sets the scale and turns it on. The clip keeps its scale, off as well as on, and a consolidated clip takes the first one's. On, the scale's rows are clear and the others shaded, in place of the black keys, and the root's rows carry an edge in the accent color, so a scale shows even in C major, whose rows are the white keys. Each pick is one step of undo, and undo leaves the clip open. A drum clip has no Scale menu.
Deviation: the reference keeps one scale for the whole song beside each clip's; here it is the clip's alone, and the key is offered, not set.
Test: apps/www/test/registry-audio/base/audio/scale-menu.test.tsx "detectKeys"; apps/daw/test/browser/checks/midi.ts "MID-010"

### MID-011 Editing in the scale
With a clip's scale on, Up and Down in Notes > Pitch move the selected notes, or every note, by steps of the scale: from E in D minor, Up goes to F, and a note out of the scale goes to the next one in it. Off, they move a semitone. Octave up and Octave down stay octaves. Fit to scale, in the same menu, moves the notes out of the scale onto its nearest pitch, the lower of two as near; it is off while the scale is. One step of undo each.
Test: apps/daw/test/browser/checks/midi.ts "MID-011"

