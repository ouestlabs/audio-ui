# Devices

The device chain of a track: effects in series, and an instrument on a MIDI track. Racks (chains in parallel) are phase 2.

### DEV-001 Order on an audio track
An audio track's chain is audio effects in series, processed left to right.
Test: apps/www/test/arrangement-engine.test.ts "DEV-001"

### DEV-002 Order on a MIDI track
A MIDI track's chain is its instrument, then audio effects. An audio effect added to a MIDI track goes after its instrument; a MIDI track with no instrument makes no sound.
Status: partial: OBS-006 says what the reference does with a second instrument.
Test: apps/www/test/arrangement-state.test.ts "DEV-002"

### DEV-003 Adding a device
A double-click on a device in the browser, or Enter on it, adds it at the end of the selected track's chain; dropped, it goes where it is dropped: on a track's chain, on a track's lane (at the end of its chain), or on the add-track row (a track of its own). With no track selected it makes one: an audio track for an effect, a MIDI track for an instrument. A track the device makes is named after it.
Status: partial: an instrument picked while an audio track is selected makes a MIDI track after it, and one dropped on an audio track is refused; OBS-014 and OBS-015 check both against the reference, and the name it gives such a track.
Test: apps/daw/test/devices.test.ts "DEV-003"; apps/daw/test/browser/run.ts "DEV-003"

### DEV-004 Moving and removing
A device is moved by dragging its title bar and removed with Backspace or Delete when selected. Each change is one step of undo.
Test: apps/www/test/arrangement-state.test.ts "DEV-004"

### DEV-005 Bypass
A device switched off passes its input unchanged to the frame, and keeps the latency its settings declare (MIX-012).
Test: apps/www/test/arrangement-engine.test.ts "DEV-005"

### DEV-006 Folding
A double-click on a device's title bar folds it to a narrow strip, and unfolds it.
Test: apps/daw/test/devices.test.ts "DEV-006"

### DEV-007 No gap in the sound
Adding, moving, bypassing or removing a device while playing does not stop the sound: the chain is rewired between two render quanta.
Test: apps/www/test/arrangement-engine.test.ts "DEV-007"

### DEV-008 One face per device
A device looks the same in a chain, on its own and in its docs page: it is drawn by its own panel.
Test: apps/daw/test/devices.test.ts "DEV-008"
