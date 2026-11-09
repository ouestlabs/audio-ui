# Export

Rendering the arrangement to a file. Phase 1 renders the main output to WAV; one file per track comes with phase 2.

### EXP-001 What is rendered
The main output, after its volume: what playback sends to the speakers.
Test: apps/www/test/arrangement-bounce.test.ts "EXP-001"

### EXP-002 The range
The whole arrangement, from its start to the end of its last clip; a time selection made before opening the dialog renders that stretch instead. Nothing past the range is rendered: an effect's tail is cut where the range ends.
Test: apps/daw/test/browser/run.ts "EXP-002"

### EXP-003 The file
Export… (Cmd+Shift+R) opens a dialog: WAV at 16 or 24 bits or 32-bit floats, FLAC at 16 or 24 bits, or MP3 at 128 to 320 kbps, at the project's sample rate; the dialog keeps the last settings. An MP3 of a project at a rate MP3 does not have comes out at the nearest one it has (48 kHz for 96 kHz). A format's encoder is loaded the first time it is asked for, and the file is encoded in chunks with a paint between two, so the page keeps answering.
Status: partial: the reference's dialog (OBS-009, version 10.1) also has the track to render, loop and mono switches, the sample rate, AIFF and a dither.
Test: apps/www/test/registry-audio/base/lib/audio-encode.test.ts "EXP-003", apps/www/test/registry-audio/base/audio/export-dialog.test.tsx "EXP-003", apps/daw/test/browser/run.ts "EXP-003"

### EXP-004 Dither
Rendered below 32 bits, the samples are dithered with triangular noise by default; dither can be turned off. It is applied once, at the very end.
Status: open: the export rounds each sample to the nearest step and dithers nothing yet.

### EXP-005 Normalize
When asked, the render's loudest sample is brought to 0 dBFS, or its loudness to a target, -14 LUFS for streaming, -16 for podcasts or -23 for broadcast, as far as its true peak stays at or under -1 dBTP: a render that would pass the ceiling lands under its target, and nothing is limited.
Test: apps/www/test/registry-audio/base/lib/audio-export.test.ts "EXP-005", apps/daw/test/browser/run.ts "EXP-005"

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

### EXP-010 How loud the file is
The notice of a finished export says how loud the file came out: its integrated loudness in LUFS and its true peak in dBTP (ITU-R BS.1770), its normalization included.
Test: apps/daw/test/browser/run.ts "EXP-010"
