# Performance targets

Numbers `apps/daw` must reach on the machine they were measured on, against the reference DAW measured there too. Each target says how it is measured, so it can be taken again after a change.

The machine: a MacBook Air (M1, 16 GB), macOS 27, Chrome, a USB output at 48 kHz. The installed reference is a version built for Intel processors only, so it runs translated (Rosetta 2) on this machine: its figures are pessimistic, and are written down as such.

### PRF-001 Output latency
The engine's output latency (`baseLatency` + `outputLatency` of its context, the Chrome default `latencyHint: "interactive"`) is at most the overall latency the reference reports at its default buffer, on the same output.
Measure: the engine line (ENG-001); the reference's audio settings (OBS-010).

### PRF-002 From a key to the sound
From a key press (its event time) to the first frame of the note it plays leaving the output: at most 1.5 times the output latency.
Measure: `apps/daw/test/perf/key-latency.ts`, from the event's `timeStamp` to the note's scheduled start plus the output latency.

### PRF-003 Start latency
From the press of Play to the first frame of the arrangement at the output: at most 20 ms plus the output latency.
Measure: `apps/daw/test/perf/start-latency.ts`.

### PRF-004 Tracks held
N stereo audio tracks playing at once, each through M devices, play 10 minutes with no dropout: the render load the browser reports (DevTools protocol, `WebAudio.getRealtimeData`) stays under 80 % at its peak, and no glitch is counted. N and M are set where the reference holds the same set without a dropout, on this machine (OBS-011).
Measure: `apps/daw/test/perf/capacity.ts` on the generated load set.

### PRF-005 Export speed
A reference arrangement (16 stereo tracks, 3 minutes, an equalizer and a compressor on each, a reverb and a delay on two returns) renders in no more time than the reference takes to export the same set.
Measure: `apps/daw/test/perf/export.ts`; the reference timed by hand (OBS-012).

### PRF-006 Memory
Planned (phase 2): the user's longest set, 17 stereo stems of 11 min 48 s at 48 kHz, plays whole under 1.5 GB for the tab.

### PRF-007 The interface keeps up
During playback with N tracks, the page draws at the display's rate: no task longer than 50 ms, and meters and playhead move without React rendering on each frame.
Measure: `apps/daw/test/perf/frames.ts` (long tasks and commits counted over a minute).
