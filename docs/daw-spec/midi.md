# MIDI playback

How the notes of MIDI clips reach the instruments. Editing notes is the piano roll's, already in the registry; this chapter is what playback does with them.

### MID-001 Notes go to the track's instrument
Each MIDI track plays its notes through the instrument of its device chain. A MIDI track with no instrument plays nothing.
Test: apps/daw/test/midi.test.ts "MID-001"

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
