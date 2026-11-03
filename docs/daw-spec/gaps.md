# Gaps

What building `apps/daw` found missing or broken in audio/ui, and what fixed it. A gap is fixed where it lives (`packages/core`, `packages/ui` or the registry), with tests, a changeset and the docs, then installed again in the app; `apps/daw` never works around one.

Each entry: where it was found, what is wrong, the rule it breaks, and the fix with its commit once there is one.

## Open

### G-001 The Timeline block plays no audio
Found reading `block-timeline.tsx`: dropped files are decoded for their length and peaks only, and audio clips are drawn but silent. Breaks ARR-001, CLP-001 to CLP-012.
Fix: a clip player on an AudioWorklet (`@audio-ui/core/playback` for the render, a registry lib for the node), driven by the arrangement.

### G-002 The arrangement runs on a timer, not the audio clock
`use-simulated-clock` advances with `requestAnimationFrame`; `use-midi-playback` schedules notes from that frame loop. A busy frame shifts the notes, and nothing can line them up with audio clips. Breaks ENG-004, MID-002, TRN-009.
Fix: a transport in frames of the audio clock, shared by the clip players, the note scheduler and the playhead.

### G-003 MIDI clips play a fixed tone
`use-midi-playback` plays every note on a triangle oscillator of its own instead of the track's instrument device. Breaks MID-001.

### G-004 The arrangement view cannot be installed
It lives in a 2,805-line example block, which the CLI writes to `components/examples/`. A project can only copy it whole. The view's parts (rows of tracks, file drops, the keyboard commands, the clip dock) need to be items of their own, which the block composes.

### G-005 The arrangement document has no mixer
`arrangement-state` holds audio and MIDI tracks with a gain, a pan, a mute and a solo: no device chain, no send, no output, no return track, no main track. Breaks MIX-001 to MIX-009, DEV-001 to DEV-004.
Fix (decided): the document takes them, with one history.

### G-006 Automation is a share of the song
A track's automation is only its volume and pan, and its points are fractions of the arrangement's length: `set-duration` stretches every envelope, and `insert-time` and `remove-time` move the clips but leave the envelopes where they were.

### G-007 No mixer engine
The Mixer block is a demo that makes its own sound, with no send and no return; nothing in the registry builds a track's chain, its sends and returns, or a main track.

### G-008 The pan law is the browser's
The registry pans with `StereoPannerNode`: a mono signal at the centre comes out 3 dB down on each side, and a stereo one panned left has its right channel moved into the left. Breaks MIX-003 (0 dB at the centre, +3 dB at the side, each channel on its own gain).

### G-009 Reverse plays the other end of the recording
Reversing a clip flips a flag: the whole recording is mirrored and the clip keeps its offset, so a clip that played the first bar plays the last bar backwards. Breaks CLP-008.

### G-010 A clip names its recording through its id
`Arranged` has no field for the recording it plays: the block finds it by cutting the piece suffix off the clip's id (`file3-2` is `file3`). Consolidating a stretch copies its first clip and renders nothing. Breaks ARR-008.

### G-011 The device catalog and the offline render are locked in a block
The list that pairs each device with its engine and its panel, and `bounce()`, live inside `block-device-chain`: a project cannot install them to build a chain per track or render one.

### G-012 Device latency is declared, never compensated
Devices declare their latency (`latency` in `defineDevice`), and nothing lines the tracks up with it: a send in parallel with a compressor that looks ahead combs. Breaks MIX-012.

### G-013 Every recording is decoded whole into memory
A decoded recording is 32-bit floating point at the engine's rate: the user's 17 stems of 11 min 48 s (2.2 GB as 16-bit files) take about 4.6 GB, more than a tab holds. Breaks PRF-006.
Fix: phase 2, streaming from the project's storage.

### G-014 The master bus hides a limiter
`use-master-bus` ends in a compressor set as a limiter, so a mix over full scale is squashed instead of shown, and a render cannot match playback. Breaks MIX-009, EXP-006.

## Fixed

None yet.
