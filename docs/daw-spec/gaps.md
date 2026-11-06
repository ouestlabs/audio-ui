# Gaps

What building `apps/daw` found missing or broken in audio/ui, and what fixed it. A gap is fixed where it lives (`packages/core`, `packages/ui` or the registry), with tests, a changeset and the docs, then installed again in the app; `apps/daw` never works around one.

Each entry: where it was found, what is wrong, the rule it breaks, and the fix with its commit once there is one.

## Open

### G-006 Automation is a share of the song
A track's automation is only its volume and pan, and its points are fractions of the arrangement's length: `set-duration` stretches every envelope, and `insert-time` and `remove-time` move the clips but leave the envelopes where they were.
Status: partial: the points stay fractions of the arrangement's length, so a tempo change keeps their musical place, but `set-duration`, `insert-time` and `remove-time` retime them so each keeps its time (`automationForDuration`, `automationAfterInsert`, `automationAfterRemove` in `lib/arrangement-state`): a longer arrangement holds the last value after the last point, a shorter one cuts the envelope at its new end, time inserted holds the value across it, time removed closes up with a step. Automation moves a track's devices' parameters now too (AUT-001). The loop still stays where it was when time is inserted or taken out.


### G-027 A lone underrun, now and then
In about one short pass of PRF-004 in six, the browser counts one underrun, on a set of 8 or 16 tracks whose load peaked under 30 %: never in the three passes of 10 minutes, never in 8 plays and stops of 16 tracks counted apart. Each time it came on a set just opened, after the previous one closed in the same browser. It came again once in three passes of PRF-006, while 17 streamed stems played, in a browser of its own. Breaks PRF-004 when it happens.
Fix: to find. The cause is not established: the browser's own audio stream opening, or the closed page's, are suspects, not the load. To take again on the USB output with Chrome itself.
Status: open. Taken again on 2026-11-06 on a USB output, in the machine's Chrome with its sound on (`PERF_CHROME=1 PERF_SECONDS=30 PERF_TRACKS=8,16 bun test/perf/run.ts PRF-004`, 20 passes against the built app): 7 passes counted underruns, one to three on most (twelve once), with the load peaking between 11 % and 37 %. The set of 8 was hit 3 times and the set of 16, which runs second in the same browser, 6 times. So it is far more frequent than one pass in six, and the load is not the cause. Not yet told apart: the USB output, Chrome, or the workstation (the same passes on the laptop's speakers, and on the muted Chromium, are next).


### G-030 Two silent plays that could not be made again
Twice in the browser checks, a track that should sound read -100 dB on the main meter: `DEV-010` (a take through a rack) and `DEV-014` (a pad held in an instrument rack), each once, each passing on the next run. An export's silence (`EXP-009`) cannot explain them: it only touches offline renders.
Status: not reproduced in 34 plays made for it, 14 at low load and 10 under eight busy processes for the rack, 10 for the pad. The first came right after files were reinstalled on the dev server, so a page reloading mid-check is possible, not shown. It came once more on 2026-11-06, in `DEV-014` (the synth in a rack at -100 dB), on the first run after files were reinstalled; the same two checks then passed six runs in a row. A pad's note does stop when its panel has left the screen. To reopen if a track is ever heard silent outside a check.


## Fixed

### G-001 The Timeline block plays no audio
Found reading `block-timeline.tsx`: dropped files are decoded for their length and peaks only, and audio clips are drawn but silent. Breaks ARR-001, CLP-001 to CLP-012.
Fix: a clip player on an AudioWorklet (`@audio-ui/core/playback` for the render, a registry lib for the node), driven by the arrangement.
Status: `clip-player` (registry) runs the core's renderer in an AudioWorklet, and `arrangement-engine` plays every audio clip of a document, bit-identical when neutral (checked in Chromium). Fixed: the block plays through `arrangement-engine`: its drum and pad clips loop recordings drawn by `demo-sound` (`renderBeatLoop`, `renderHeldChord`, which now loops without a click), a dropped file is decoded at the engine's rate and plays, and each lane draws its clips' waveforms (checked in Chromium: every track's meter reads its channel).


### G-002 The arrangement runs on a timer, not the audio clock
`use-simulated-clock` advances with `requestAnimationFrame`; `use-midi-playback` schedules notes from that frame loop. A busy frame shifts the notes, and nothing can line them up with audio clips. Breaks ENG-004, MID-002, TRN-009.
Fix: a transport in frames of the audio clock, shared by the clip players, the note scheduler and the playhead.
Status: `arrangement-engine` counts its transport in frames of the audio clock and schedules notes ahead on it, and its playhead is what the speakers play. Fixed: the block runs on it, and a seek while playing plays from there.


### G-003 MIDI clips play a fixed tone
`use-midi-playback` plays every note on a triangle oscillator of its own instead of the track's instrument device. Breaks MID-001.
Status: `arrangement-engine` plays notes through each MIDI track's instrument device. Fixed: the block's Bass and Keys are MIDI tracks with a pocket synth each, and a key pressed in the piano roll plays it.


### G-004 The arrangement view could not be installed
It lives in a 2,805-line example block, which the CLI writes to `components/examples/`. A project can only copy it whole. The view's parts (rows of tracks, file drops, the keyboard commands, the clip dock) need to be items of their own, which the block composes.
Fix (decided): hooks and parts by concern, which the block composes and the DAW installs: grid and zoom, tracks and automation, selections, markers and the cursor.
Status: grid and zoom done: `use-timeline-zoom` (fitted beside the headers, zoom around a time, onto a stretch, back) and `use-timeline-grid` (adaptive or fixed, triplet, snap, Cmd+1 to 5); the block and the DAW both run on them. Tracks and automation done: `use-track-automation` (automation mode, what each lane shows, what a hand overrides) and the grip, ghost and drop line of `use-track-reorder`; heights and folds were already in `use-arrangement`. Selections done: `use-time-selection` (the stretch of time, its overlay, the clipboard and its keys), and the DAW takes `use-marquee-selection`. Markers and the cursor done: `use-timeline-markers`, `TimelineBarMarks` and `use-timeline-cursor`. Clips done: `use-arranged-clips`. The block went from 2,908 lines to about 2,300, and the DAW's arrangement composes the same items. What stays in the block is its layout, its toolbar and its own keys.


### G-005 The arrangement document has no mixer
`arrangement-state` holds audio and MIDI tracks with a gain, a pan, a mute and a solo: no device chain, no send, no output, no return track, no main track. Breaks MIX-001 to MIX-009, DEV-001 to DEV-004.
Fix (decided): the document takes them, with one history.
Status: the document holds them (devices, sends, return tracks, the main track, their commands, one history); nothing plays them yet (G-007).


### G-007 No mixer engine
The Mixer block is a demo that makes its own sound, with no send and no return; nothing in the registry builds a track's chain, its sends and returns, or a main track.
Status: fixed by `mixer-engine` (channels, chains, pre or post-fader sends, returns, solo, delay compensation, meters, a main track with no limiter), which `arrangement-engine` plays through; checked in Chromium (MIX-003, MIX-004, MIX-012).


### G-008 The pan law is the browser's
The registry pans with `StereoPannerNode`: a mono signal at the centre comes out 3 dB down on each side, and a stereo one panned left has its right channel moved into the left. Breaks MIX-003 (0 dB at the centre, +3 dB at the side, each channel on its own gain).
Status: fixed in `mixer-engine`, on `panGains` from `@audio-ui/core/playback`: each channel on its own gain. Devices that pan as part of their sound (auto-pan, utility) keep their own design.


### G-009 Reverse plays the other end of the recording
Reversing a clip flips a flag: the whole recording is mirrored and the clip keeps its offset, so a clip that played the first bar plays the last bar backwards. Breaks CLP-008.
Status: fixed: the clip panel's Reverse mirrors the region and the loop with the flag (`reversedSettings`).


### G-010 A clip names its recording through its id
`Arranged` has no field for the recording it plays: the block finds it by cutting the piece suffix off the clip's id (`file3-2` is `file3`). Consolidating a stretch copies its first clip and renders nothing. Breaks ARR-008.
Status: `Arranged.recording` names it, and every piece and copy keeps it; the DAW and the Timeline block consolidate by rendering (ARR-020). The block still finds its demo's recordings by their ids.


### G-011 The device catalog and the offline render are locked in a block
The list that pairs each device with its engine and its panel, and `bounce()`, live inside `block-device-chain`: a project cannot install them to build a chain per track or render one.
Status: fixed. `device-library` lists every device with its engine and `device-panels` every panel, both by stable id; the device chain block builds its library from them (the 20 effects, where it listed 10), and `renderArrangement` renders a whole arrangement offline.


### G-012 Device latency is declared, never compensated
Devices declare their latency (`latency` in `defineDevice`), and nothing lines the tracks up with it: a send in parallel with a compressor that looks ahead combs. Breaks MIX-012.
Status: fixed by `delayCompensation` (core) in `mixer-engine`; a check in Chromium measures every effect's real delay against what it declares (all 20 agree, filters' phase aside).


### G-013 Every recording is decoded whole into memory
A decoded recording is 32-bit floating point at the engine's rate: the user's 17 stems of 11 min 48 s (2.2 GB as 16-bit files) take about 4.6 GB, more than a tab holds. Breaks PRF-006.
Fix: streaming. The core keeps recordings in pages of shared memory (`createPagePool`, `createRecordingStream`, `PageCache`) and plans the pages each track will read (`pagesAhead`); a Worker (`RECORDING_LOADER_WORKER`) loads them from the origin private file system. `clip-player` takes a `StreamedSource`, `arrangement-engine` asks for the next 4 s of pages as it plays, cues them at the cursor while stopped and waits for them in an export. The DAW decodes each dropped file once into a cache of 32-bit floats (`cache/<id>.f32`), one file after the other, and opens a project from that cache without decoding.
Status: fixed. The user's longest set, 17 stems of 11 min 48 s (4.6 GB decoded), plays with the tab at about 500 MB (PRF-006). A play from a place no page was loaded for, while playing, starts silent until the disk catches up.


### G-014 The master bus hides a limiter
`use-master-bus` ends in a compressor set as a limiter, so a mix over full scale is squashed instead of shown, and a render cannot match playback. Breaks MIX-009, EXP-006.
Status: the arrangement engine's main track has no limiter; `use-master-bus` keeps one for the demos that use it.


### G-015 A change of tempo moved what every recording plays
`set-tempo` scaled an audio clip's length, offset and source length, but not its warp markers nor its loop: a player that reads the recording in seconds would play another stretch of it after the change. The reference keeps an unwarped recording at its speed and moves a warped one through its markers. Breaks TRN-012 for audio clips.
Fix: `scaleClip` follows the warp; `settleOverlaps` ends a recording that keeps its speed where the next clip starts.


### G-016 Instruments play now, and only now
The instrument contract (`InstrumentBinding` in `@audio-ui/core/device`) has `noteOn(note)` and `noteOff()`, with no time and no note: a host cannot schedule a note ahead on the audio clock, nor say which held note ends. Breaks MID-002.
Fix (decided): an optional time and a note identity on both.
Status: fixed: `NoteTiming` (core), followed by the pocket synth and the wave shaper.


### G-017 The only instrument plays one note, at one level
The pocket synth is monophonic and its notes have no velocity: chords collapse to their last note and every note plays at the same level. Breaks MID-001 for anything but a single line.
Fix (decided): velocity on the pocket synth's notes; chords by a host that stacks one voice per note.
Status: fixed: notes have a velocity, and `arrangement-engine` gives each MIDI track a voice of its instrument per held note (eight by default); a chord sounds all its notes (checked in Chromium).


### G-018 An audio clip on the timeline draws no waveform
`ArrangedClip` draws a MIDI clip's notes, and nothing of an audio clip's recording: a track of recordings is a row of empty boxes.
Fix: `clipWaveform` in `lib/arrangement` reads a clip's source peaks the way a player reads its recording (offset, loop, reverse, warp), and `ArrangedClip` draws them from a `peaks` prop.


### G-019 The panels have no catalog
A host that draws a chain per track has to import 22 panels by hand and pair them with the ids a project stores, as the device chain block did for its 10.
Fix: `device-panels`, every panel by stable id with its width.


### G-020 The clip panel and an arranged clip are not joined
The clip panel takes `ClipSettings` and an arrangement holds `Arranged` clips: every host writes the mapping both ways by hand (the Timeline block does, the DAW does again), with the clamping of the length to the timeline.
Fix: a mapping in the registry, next to the clip panel.


### G-021 The arrangement engine has no metronome
The transport element has a metronome switch and its rhythm, and the Timeline block shows them, but nothing in `arrangement-engine` clicks: the switch is silent now that the block plays. Breaks the metronome rules of the transport chapter (to write with OBS-007).
Fix: `metronomeClicks` in core gives the clicks through the signature changes, and `setMetronome` on the engine (`metronome` on `useArrangementEngine`) plays them on the audio clock, past the mixer, off by default so an export never has them. The dots of the transport's metronome still follow the first tempo's beat after a change of signature.
Status: fixed (offline checks count the frames and the pitch of each click; I have not listened).


### G-022 A clip panel keeps its own height in a host that gives it one
Docked under the tracks at a fixed height, the clip panel's boxes and waveform stopped where their content did, and the MIDI clip panel's roll kept 18rem whatever room there was, cut off below a shorter dock.
Fix: the clip view's body fills its frame, the clip panel's waveform and the MIDI clip panel's roll take the room there is (the roll at 18rem when the panel has no height of its own, as before).
Status: fixed (checked in Chromium in the DAW's detail view).


### G-023 A style's states never reached an install
The registry build turns `cn-x` into what `.cn-x` applies, and only reads rules of that shape. A rule on a state or a descendant works on the site, which reads the sheet, and was dropped from what the CLI installs: the piano roll's keys were all white and showed no press, a sequencer's velocity fill lost its dim color and its transition, and an envelope never shook when refusing a point (its keyframes reached no project either). A pressed black key also kept its hover color on the site.
Fix: those states are variants in the class's own `@apply`, the keyframes ship in the envelope items' `css`, the build carries `css`, and `apps/www/test/style-rules.test.ts` fails on a rule of any other shape.
Status: fixed (checked in Chromium in the DAW). `apps/lab` keeps its old copies until it is reinstalled.


### G-024 A timeline's marks could not be moved
`Timeline.Mark` only placed something: a locator could not move at all, a time signature only with the arrows, in code of its own. Breaks ARR-016 and ARR-017.
Fix: `Timeline.Mark` moves with `onValueChange` or `onValueCommitted`, by a drag on the grid and by Left and Right, a press staying a press. Locators got ids, so one keeps its focus as it moves, and `TimelineLocator` and `TimelineSignature` use it.
Status: fixed (checked in Chromium in the DAW).


### G-025 What the locators and time signatures still miss
A locator's menu has no way to loop to the next one, there are no previous and next locator buttons, and inserting or taking out time leaves the locators and the time signatures where they were.
Fix: small, each. (A double-click on a locator plays from it now, as in a DAW; it renamed it before.)
Status: fixed, but for the loop when time is inserted: taking time out brings the loop along (a time inside it comes back to where it began, one after it moves back, as the reference's does), inserting leaves it where it was, which the reference's version 10.1 could not show (it has no Insert Silence); the automation follows (G-006). The previous and next buttons sit beside the Markers row's add button; a locator's menu loops from it to the next one, or to the end (`loop-to-next-locator`); inserting or taking out time moves the locators and the time signatures with the clips (`marksAfterInsert`, `marksAfterRemove`, `loopAfterRemove` in `lib/arrangement-state`; a locator at the start of the time taken out goes with it, a time signature in it starts where it did, so what follows keeps its meter).


### G-026 A play started later than the target
Play reached the output 20 ms plus the output latency after the press, and the millisecond or two the press takes to reach the engine put it over PRF-003: the lead a play takes was a guess, never measured. Breaks PRF-003.
Fix: measured with 32 tracks playing, a message reaches a worklet within one render callback (5.3 ms at 48 kHz) of the frame the engine reads, so `arrangement-engine` schedules a play 12 ms ahead, a little over twice that, and PRF-003's measure checks the margin each time it runs.
Status: fixed (median 46.3 ms from the press to the output, was 55.9 ms).


### G-028 Tracks had no color in a project whose theme has no chart colors
The timeline's track colors read the theme's `--chart-1` to `--chart-5`, which an install does not bring and the DAW's theme did not have: every track, its clips and its strip in the mixer were the same, and a color picked in a header's menu changed nothing.
Fix: each track color falls back to the design system's own, the shades the docs show, when the theme has none; a theme that has them keeps its own.
Status: fixed (checked in Chromium in the DAW's mixer, light and dark).


### G-029 A chain inside a chain took the same drop twice
`DeviceChain` counted every slot inside it, a rack's chain's included, and let a drop and a drag go on up: a device dropped on a rack's chain was added to it and to the track's chain around it, and a device dragged inside a rack dragged the rack too.
Fix: a chain counts its own slots only, and a drop, the drag over it and a drag started inside stop at the innermost chain.
Status: fixed (checked in Chromium in the DAW, DEV-010).


### G-031 Sixteen tracks through an equalizer and a compressor load the audio thread to three quarters
Measured on 2026-11-04, 30 s each: 16 tracks not stretched, load mean 73 %, peak 89 %, one underrun; the same 16 stretched in Repitch, mean 73 %, peak 93 %, 38 underruns. Stretching costs next to nothing more: the load is the tracks'. PRF-004 read 26 % for the same set in phase 1, on a quieter machine; the graph of a track has barely changed since, so that gap is not shown to be the code's. A trace of the audio nodes over 8 s gave, per render quantum, 32 worklets where the clips need 16 (each compressor's key detector ran with its key off), about 330 gain nodes (some 20 a track: 9 in the channel strip, 9 in the compressor, 3 in the equalizer), 64 biquads and 16 compressor nodes.
Fix: the compressor links a path to its output only while it is heard, and makes its key detector the first time the key is on, so at full mix with no key it renders its node alone (`apps/www/test/registry-audio/base/lib/compressor-engine.test.ts` "G-031").
Status: fixed: at the end of phase 4, 16 tracks load the audio thread at 40 % on average, peak 59 %, with no underrun (PRF-004). The channel strip's nine gains a track are where to look next if a set needs more.
