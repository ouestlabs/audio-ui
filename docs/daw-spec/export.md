# Export

Rendering the arrangement to a file. Phase 1 renders the main output to WAV; one file per track comes with phase 2.

### EXP-001 What is rendered
The main output, after its volume: what playback sends to the speakers.
Test: apps/www/test/arrangement-bounce.test.ts "EXP-001"

### EXP-002 The range
The whole arrangement, from its start to the end of its last clip; a time selection made before opening the dialog renders that stretch instead. Nothing past the range is rendered: an effect's tail is cut where the range ends.
Test: apps/daw/test/browser/run.ts "EXP-002"

### EXP-003 The file
WAV, at the project's sample rate, in 16 or 24-bit whole numbers or 32-bit floating point.
Status: partial: OBS-009 gives the reference's defaults. AIFF and FLAC are planned (phase 2).
Test: apps/www/test/wav-file.test.ts "EXP-003"

### EXP-004 Dither
Rendered below 32 bits, the samples are dithered with triangular noise by default; dither can be turned off. It is applied once, at the very end.
Test: apps/www/test/wav-file.test.ts "EXP-004"

### EXP-005 Normalize
When asked, the render's loudest peak is brought to 0 dBFS.
Test: apps/www/test/wav-file.test.ts "EXP-005"

### EXP-006 The render is what plays
An offline render and playback of the same arrangement give the same frames: the same engine runs on an offline context.
Test: apps/www/test/arrangement-bounce.test.ts "EXP-006"

### EXP-007 Neutral export
Rendered at 32-bit float with no non-neutral operation (CLP-001), a clip's recording comes out bit-identical.
Test: apps/www/test/arrangement-bounce.test.ts "EXP-007"

### EXP-008 Progress and cancel
The render shows its progress and can be cancelled, which leaves no file.
Test: apps/daw/test/export.test.ts "EXP-008"

### EXP-009 A render never starts ahead of its players
A render starts only once every clip player has confirmed it heard of the play. Started before, a short render could end before the message arrived and come out silent (18 of 2,281 renders under load, none of 2,052 with this).
Test: apps/www/test/browser/arrangement-engine.check.ts "EXP-009"
