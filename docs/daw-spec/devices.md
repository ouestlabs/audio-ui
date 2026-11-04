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
The fold button of a device's title bar folds it to a narrow strip. A click anywhere on the strip, outside its buttons, unfolds it; a drag of the strip moves the device and leaves it folded. The on square stays where it is, with the same shape.
Test: apps/daw/test/browser/run.ts "DEV-006"

### DEV-007 No gap in the sound
Adding, moving, bypassing or removing a device while playing does not stop the sound: the chain is rewired between two render quanta.
Test: apps/www/test/arrangement-engine.test.ts "DEV-007"

### DEV-008 One face per device
A device looks the same in a chain, on its own and in its docs page: it is drawn by its own panel.
Test: apps/daw/test/devices.test.ts "DEV-008"

### DEV-010 Racks
A rack is a device that holds chains of devices side by side: the sound goes into every chain, through its devices in series, and the chains are summed. Each chain has its volume, pan, switch and solo, as a track does; a soloed chain silences the others. The effects picked on a chain are grouped into a rack, one chain of them, where the first was; a rack can also come from the library with one empty chain, and chains are added and removed. A device inside a rack is changed, switched off, moved and removed as on a track; a rack can hold racks. A drag of a chain's fader or of a macro is one step of undo.
Test: apps/www/test/registry-audio/base/lib/arrangement-racks.test.ts "DEV-010"; apps/www/test/browser/arrangement-engine.check.ts "DEV-010"; apps/daw/test/browser/run.ts "DEV-010 and DEV-012"; apps/daw/test/browser/run.ts "DEV-010: a rack's chain"
In the DAW: Add a rack, at the end of the chain, puts one there; a device dragged from the library into a chain of it goes there; the macros show from the Macros switch of its title bar and map from their menu, to the whole travel of the parameter. The devices lie flat in the device view, a hairline between each, the inside of a rack too. A track with no devices shows its whole view as the place to drop one, with links to the library and the racks; once it has devices, a narrow strip at the end of the chain opens the library and adds a rack. That strip stays at the right edge of the view when the devices go past it. A rack's chain has no scroll of its own: the rack is as wide as its devices, and the wheel over it moves the track's chain.

### DEV-011 A rack's delay
Chains that delay the sound differently meet on the same frame: each waits for the slowest. The rack delays the track by its slowest chain, which the track's delay compensation counts.
Test: apps/www/test/browser/arrangement-engine.check.ts "DEV-011"

### DEV-012 Macros
A rack has eight macros, each from 0 to 1. A parameter of any device inside the rack, a rack within it included, is mapped to a macro over a stretch of its travel: turning the macro from 0 to 1 moves the parameter across that stretch, along the parameter's own scale. Mapped again, the stretch changes; unmapped, the parameter plays as set.
Test: apps/www/test/registry-audio/base/lib/arrangement-racks.test.ts "DEV-012"; apps/www/test/browser/arrangement-engine.check.ts "DEV-012"; apps/daw/test/browser/run.ts "DEV-010 and DEV-012"

### DEV-013 Drum racks
A drum rack is an instrument of a MIDI track whose chains are pads. A note plays the pads that answer it, each once, as loud as its velocity, its own sound into its own devices, ringing for its decay whatever the note's length; a note no pad answers is silent. A pad plays a synthesized voice (kick, snare, hat) or a recording, pitched in semitones and cut to a decay. A new drum rack has a kick on C2, a snare on D2 and a hat on F#2. The face shows sixteen pads on a bank of the 128 notes, the first bank starting on C2; striking a pad plays it and picks it, showing its voice, tune, decay, mix and devices. A voice picked on an empty pad makes one; a recording dropped on a pad fills it and is kept with the project. The macros are a rack's. A drum rack does not go out to DAWproject.
Test: apps/www/test/registry-audio/base/lib/arrangement-drum-rack.test.ts "DEV-013"; apps/www/test/browser/arrangement-engine.check.ts "DEV-013"; apps/daw/test/project-file.test.ts "DEV-013"; apps/daw/test/browser/run.ts "DEV-013"

### DEV-014 Instrument racks
An instrument rack is an instrument of a MIDI track whose chains each start with an instrument, then effects. A note plays every chain's instrument at once, in layers, through that chain's effects; a chain switched off or soloed away is silent. A new instrument rack has one empty chain; an instrument dragged into a chain goes at its head, in place of the one there was. An effect rack's chains and a drum rack take no instrument, and a chain takes no rack as its instrument. The macros are a rack's.
Test: apps/www/test/registry-audio/base/lib/arrangement-drum-rack.test.ts "DEV-014"; apps/www/test/browser/arrangement-engine.check.ts "DEV-014"; apps/daw/test/browser/run.ts "DEV-014"

### DEV-015 Zones
Each chain of an instrument rack plays a zone: a range of keys and a range of velocities, both ends in. A note plays the chains whose zone holds both its pitch and its velocity: chains split across the keyboard, or soft and hard layers. A new chain plays every key and every velocity. The rack's Zones switch shows each chain's two ranges, the keys by their names and the velocities from 0 to 127; a drag of one is one step of undo.
Test: apps/www/test/registry-audio/base/lib/arrangement-drum-rack.test.ts "DEV-015"; apps/www/test/browser/arrangement-engine.check.ts "DEV-015"; apps/daw/test/browser/run.ts "DEV-015"
