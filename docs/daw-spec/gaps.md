# Gaps

What building `apps/daw` found missing or broken in audio/ui, and what fixed it. A gap is fixed where it lives (`packages/core`, `packages/ui` or the registry), with tests, a changeset and the docs, then installed again in the app; `apps/daw` never works around one.

Each entry: where it was found, what is wrong, the rule it breaks, and the fix with its commit once there is one.

## Open

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

### G-004 The arrangement view cannot be installed
It lives in a 2,805-line example block, which the CLI writes to `components/examples/`. A project can only copy it whole. The view's parts (rows of tracks, file drops, the keyboard commands, the clip dock) need to be items of their own, which the block composes.

### G-005 The arrangement document has no mixer
`arrangement-state` holds audio and MIDI tracks with a gain, a pan, a mute and a solo: no device chain, no send, no output, no return track, no main track. Breaks MIX-001 to MIX-009, DEV-001 to DEV-004.
Fix (decided): the document takes them, with one history.
Status: the document holds them (devices, sends, return tracks, the main track, their commands, one history); nothing plays them yet (G-007).

### G-006 Automation is a share of the song
A track's automation is only its volume and pan, and its points are fractions of the arrangement's length: `set-duration` stretches every envelope, and `insert-time` and `remove-time` move the clips but leave the envelopes where they were.

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
Status: `Arranged.recording` names it, and every piece and copy keeps it; the block still finds recordings by their ids, and consolidating still renders nothing (phase 3).

### G-011 The device catalog and the offline render are locked in a block
The list that pairs each device with its engine and its panel, and `bounce()`, live inside `block-device-chain`: a project cannot install them to build a chain per track or render one.
Status: fixed. `device-library` lists every device with its engine and `device-panels` every panel, both by stable id; the device chain block builds its library from them (the 20 effects, where it listed 10), and `renderArrangement` renders a whole arrangement offline.

### G-012 Device latency is declared, never compensated
Devices declare their latency (`latency` in `defineDevice`), and nothing lines the tracks up with it: a send in parallel with a compressor that looks ahead combs. Breaks MIX-012.
Status: fixed by `delayCompensation` (core) in `mixer-engine`; a check in Chromium measures every effect's real delay against what it declares (all 20 agree, filters' phase aside).

### G-013 Every recording is decoded whole into memory
A decoded recording is 32-bit floating point at the engine's rate: the user's 17 stems of 11 min 48 s (2.2 GB as 16-bit files) take about 4.6 GB, more than a tab holds. Breaks PRF-006.
Fix: phase 2, streaming from the project's storage.

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
Fix: a click on the audio clock in the engine, on the beats of the signature in force, the downbeat accented, heard in playback and left out of an export.

## Fixed

None yet.
