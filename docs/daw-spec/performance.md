# Performance targets

Numbers `apps/daw` must reach on the machine they were measured on, against the reference DAW measured there too. Each target says how it is measured, so it can be taken again after a change.

The machine: a MacBook Air (M1, 16 GB), macOS 27, Chrome, a USB output at 48 kHz. The installed reference is a version built for Intel processors only, so it runs translated (Rosetta 2) on this machine: its figures are pessimistic, and are written down as such.

`apps/daw/test/perf/run.ts` takes the measures in Chromium, muted, against the built app (`bun run build`, `bunx vite preview --port 4173`, then `bun run test:perf`). Times are read off the audio clock: a sound scheduled at a context time is heard at the page time `getOutputTimestamp` maps it to, which counts the output's latency. The sets it plays are generated: tracks of one made-up take, an equalizer and a compressor on each.

The figures under **Measured** were taken on 2026-11-03, Chromium 156, on the built-in speakers at 48 kHz (the default output that day), on the charger.

### PRF-001 Output latency
The engine's output latency (`baseLatency` + `outputLatency` of its context, the Chrome default `latencyHint: "interactive"`) is at most the overall latency the reference reports at its default buffer, on the same output.
Measure: `apps/daw/test/perf/run.ts "PRF-001"`, the figures of the engine line (ENG-001); the reference's audio settings (OBS-010).
Measured: 37.3 ms (base 5.3 ms, output 32.0 ms). The reference's figure waits for OBS-010.

### PRF-002 From a key to the sound
From a key press (its event time) to the first frame of the note it plays leaving the output: at most 1.5 times the output latency.
Measure: `apps/daw/test/perf/run.ts "PRF-002"`: 20 presses on a key of the piano roll, from the press's `timeStamp` to when its oscillator's start is heard.
Measured: median 36.9 ms, worst 39.4 ms, against a target of 56.0 ms. Met.

### PRF-003 Start latency
From the press of Play to the first frame of the arrangement at the output: at most 20 ms plus the output latency.
Measure: `apps/daw/test/perf/run.ts "PRF-003"`, with 32 tracks loaded: 15 presses of Space, from the press's `timeStamp` to when the frame the play was scheduled at is heard. It also checks that the lead a play takes covers twice the longest a message takes to reach a worklet while the tracks play, so no track hears of a play after its first frame (TRN-015).
Measured: at first, median 55.9 ms and worst 59.1 ms, over the target of 57.3 ms: a play was scheduled 20 ms ahead, and the press takes a millisecond or two to reach the engine. A message reaches a worklet at most 5.3 ms (one render callback) after the frame the engine reads, with 4 tracks or with 32 playing, so the lead is now 12 ms: median 46.3 ms, worst 47.6 ms. Met.

### PRF-004 Tracks held
N stereo audio tracks playing at once, each through M devices, play 10 minutes with no dropout: the render load the browser reports (DevTools protocol, `WebAudio.getRealtimeData`) stays under 80 % at its peak, and no glitch is counted. N and M are set where the reference holds the same set without a dropout, on this machine (OBS-011).
Measure: `apps/daw/test/perf/run.ts "PRF-004"`, on sets of 8, 16 and 32 tracks: the render load sampled each second, and the underruns `AudioContext.playbackStats` counts.
Measured, 10 minutes each: 8 tracks peak 43 %, mean 17 %; 16 tracks peak 35 %, mean 26 %; 32 tracks peak 70 %, mean 45 %; no underrun. The peaks are brief spikes over a steady load. N and M are set against the reference once OBS-011 is in: until then, 32 tracks with two devices each hold. One underrun was counted once, on the first set a fresh browser played, in a pass of 20 seconds, and not again in five passes after.

### PRF-005 Export speed
A reference arrangement (16 stereo tracks, 3 minutes, an equalizer and a compressor on each, a reverb and a delay on two returns) renders in no more time than the reference takes to export the same set.
Measure: `apps/daw/test/perf/run.ts "PRF-005"`, from the press of Export to the file; the reference timed by hand (OBS-012).
Measured: 41.7 s, 4.3 times faster than real time. The comparison waits for OBS-012.

### PRF-006 Memory
Planned (phase 2): the user's longest set, 17 stereo stems of 11 min 48 s at 48 kHz, plays whole under 1.5 GB for the tab.

### PRF-007 The interface keeps up
During playback with N tracks, the page draws at the display's rate: no task longer than 50 ms, and meters and playhead move without React rendering on each frame.
Measure: `apps/daw/test/perf/run.ts "PRF-007"`: over 30 s of 16 tracks playing, the long tasks, React's commits (through the hook its developer tools use) and the gaps between frames.
Measured: no long task, no React commit, 60 frames a second, the longest gap 16.7 ms. Met.
