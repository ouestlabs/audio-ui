# Engine

The audio engine's state, and the line of the interface that reports it.

### ENG-001 The engine line
A line of the interface shows the engine's sample rate, its output latency in milliseconds, its state (running, suspended, closed or interrupted) and, where the browser measures it, its render load.
Test: apps/daw/test/engine.test.ts "ENG-001"

### ENG-002 Waking up
Browsers keep audio asleep until the page is used: the engine starts suspended, says so, and wakes on the first press of a key or a pointer, without that press being lost (a Space that wakes it also starts playback).
Test: apps/daw/test/engine.test.ts "ENG-002"

### ENG-003 Interrupted
When the system takes the audio away (another app, a call), the line says so and playback stops; the engine comes back when it can, and playback does not restart by itself.
Test: apps/daw/test/engine.test.ts "ENG-003"

### ENG-004 One clock
The audio clock is the only clock of playback: the playhead, the notes and the clips all read it, never a timer of the page.
Test: packages/core/src/audio/playback/transport.test.ts "ENG-004"
