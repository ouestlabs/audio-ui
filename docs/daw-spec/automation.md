# Automation

What moves by itself as the arrangement plays: a track's volume and pan, which the arrangement chapter covers (ARR-013), and from phase 3 any parameter of its devices.

### AUT-001 A device's parameter follows its envelope
A track's chooser lists its volume and pan, then every parameter of its devices, device by device, down its racks. A parameter picked shows its envelope over the lane, standing faint where the device has it until a point is moved. Playing, and in an export alike, the parameter is set to where its envelope stands every 10 ms, and the device smooths the step as it smooths any change.
Test: apps/www/test/registry-audio/base/lib/arrangement-automation.test.ts "AUT-001"; apps/www/test/browser/arrangement-engine.check.ts "AUT-001"; apps/daw/test/browser/run.ts "AUT-001"

### AUT-002 A rack's macros
A rack's eight macros are parameters of the rack: an envelope of a macro turns everything mapped to it, as turning it by hand does.
Test: apps/www/test/browser/arrangement-engine.check.ts "AUT-002"

### AUT-003 A parameter moved by hand
A device's parameter moved by hand, or a macro turned, stops following its envelope and plays as set, its envelope greyed, until Re-enable automation, or until its envelope is edited again: as a track's volume and pan do (ARR-013).
Test: apps/www/test/registry-audio/base/lib/arrangement-automation.test.ts "AUT-003"; apps/daw/test/browser/run.ts "AUT-003"

### AUT-004 Envelopes go with their devices
A device removed takes its envelopes, and those of the devices in its racks, with it. A track duplicated keeps its devices' envelopes on the copies of its devices.
Test: apps/www/test/registry-audio/base/lib/arrangement-automation.test.ts "AUT-004"

### AUT-005 Through DAWproject
A device's envelopes stay out of a `.dawproject` file, and its report says so by track; the volume and pan go out as before (PRJ-008).
Test: apps/www/test/registry-audio/base/lib/dawproject.test.ts "AUT-005"
