# Mixer

What each track does to its sound on the way to the main output, the sends and the return tracks. Group tracks are phase 2.

### MIX-001 Signal flow
In a track, the clips (or the instrument) feed the device chain, left to right, then the volume, then the pan, then the track activator, then the track's output. A send set to post-fader taps the signal after the activator; one set to pre-fader taps it before the pan, the volume and the activator.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-001"

### MIX-002 Volume
The volume runs from silence to +6 dB, 0 dB by default; a double-click sets it back to 0 dB. A track's fader in the arrangement and its channel in the mixer are one and the same: the same range and the same place, each moved by the other.
Checked against the reference: +6.0 dB at the top (OBS-004).
Test: apps/www/test/mixer.test.ts "MIX-002"

### MIX-003 Pan
The pan runs from 50 left to 50 right, centred by default, and follows a constant-power law with sine curves: 0 dB on both channels at the centre, +3 dB on the side it is turned to and silence on the other at either end. Each channel of a stereo signal is set by its own gain: nothing of the left channel moves into the right.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-003"

### MIX-004 Track activator
A track switched off sends nothing to its output and nothing through its post-fader sends; its pre-fader sends still feed their returns.
Deviation: the reference's activator is a numbered button, lit while the track is on, and it has no mute. Here the switch is a Mute (M), lit while the track is muted: the same effect in the opposite sense, kept because the header's and the mixer's Solo, Mute and Arm are one group of switches.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-004"

### MIX-005 Solo
Soloing a track silences every track that is not soloed and that does not feed a soloed one. One track is soloed at a time; Cmd adds a track to the solo. Soloed tracks keep their pan.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-005"

### MIX-006 Return tracks and solo
With solo in place on, soloing a track keeps the return tracks heard, so the track is heard with its reverb. Soloing a return track silences the main output of the other tracks but keeps what they send to that return.
Checked against the reference: solo in place is on by default (OBS-005).
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-006"

### MIX-007 Sends
Each track has a send per return track, from silence to 0 dB, silent by default, and post-fader unless the return is set to pre.
Checked against the reference: a send reaches 0.0 dB at the top and starts at -inf (OBS-004).
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-007"

### MIX-008 Return tracks
A return track has a device chain, a volume, a pan, an activator and a solo, and plays no clips. Its own sends are off until turned on, so nothing feeds back by default.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-008"

### MIX-009 The main track
Every track and return goes to the main track, which has a device chain and a volume, no sends, and goes to the audio output. Nothing limits it: a mix that goes over full scale is shown by the meters, not hidden.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-009"

### MIX-010 No clipping inside
Between devices and tracks the signal is floating point: a level over 0 dBFS passes through and comes back down without distortion. Only the output and an export to whole-number samples can clip.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-010"

### MIX-011 Meters
Each track and the main track show their peak and their RMS level, the loudest peak held, and a mark when a frame went over 0 dBFS, until it is clicked.
Each channel, the main track's too, has its loudest sample in dB in a pill over its pan, red over 0 dBFS until clicked, as the reference draws it on every track (OBS-013, version 10.1); the main track has a scale beside its meter.
Test: apps/daw/test/mixer.test.ts "MIX-011"; apps/daw/test/browser/run.ts "MIX-011"

### MIX-012 Delay compensation
Whatever the latency its devices declare, every path (each track, each send, each return) reaches the main track lined up to the frame. A bypassed device keeps the latency its settings declare, so bypassing it moves nothing.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-012"

### MIX-013 Changes without zipper
A volume, a pan or a send moved by hand glides to its new value within 10 ms instead of jumping.
Test: apps/www/test/mixer.test.ts "MIX-013"

### MIX-014 Several tracks at once
With several tracks selected, moving the volume, the pan, the activator or the solo of one of them moves it on all of them.
Test: apps/daw/test/mixer.test.ts "MIX-014"

### MIX-015 The mixer and the detail view take turns
Under the arrangement, one panel shows the clip, the devices or the mixer, one at a time, chosen by the tabs of its bar (the clip view's own strip carries them while it shows a clip), by the keys, or by a device or a clip that opens it. Both at once would leave the tracks no room. Like the library on the left, the panel is always there: folded, it is its bar alone, and the whole bar opens it; open, a press anywhere on its bar outside its tabs folds it, and so does one on the library's bar, or on the clip view's strip outside its controls. The line between the arrangement and the panel is dragged, or moved with the arrow keys, to share the height, from the least each view needs to show all of it to 70 %; dragged under that least, it folds the panel. Each view comes back at the height it was given. The mixer's channels fill that height, every fader as long as the others and never under a fader's own least. The mixer's own least holds a whole channel, its sends included: each row of two sends past the first adds a row's height to it, and the panel opens at that height when a return is added, as the reference's mixer grows with its sends, so no switch is cut off on a short window. A choice of this workstation: the reference draws its mixer in another view. Picking a clip also picks its track, so the devices tab shows that track's devices, not those of a track or a return picked before the clip.
Test: apps/daw/test/browser/run.ts "MIX-015"

### MIX-020 Group tracks
Cmd+G puts the picked tracks into a new group track where the first of them was; a group can hold groups. A group is a track of its own, with its chain, its volume, pan, mute, solo and sends, and the tracks in it play into it instead of into the main track. It holds no clip: its lane shows what its tracks play. Folding it hides its tracks; moving it, duplicating it or removing it takes them along; a track moved among a group's tracks joins it. A track's menu has Group, a group's has Ungroup. In the mixer, a track in a group names the group it plays into, and a folded group hides its tracks' channels. Cmd+Shift+G dissolves the group picked, or the one a picked track is in, its tracks going up a level. Soloing a track keeps the groups it is in heard; soloing a group lets its tracks be heard. A group goes out to DAWproject as a track holding its tracks, its channel a submix, and comes back in as a group.
Test: apps/www/test/registry-audio/base/lib/arrangement-groups.test.ts "MIX-020"; packages/core/src/audio/playback/mixer.test.ts "MIX-020"; apps/www/test/browser/arrangement-engine.check.ts "MIX-020"; apps/daw/test/browser/run.ts "MIX-020"

### MIX-021 Delay compensation through groups
Wherever paths meet, at a group, a return or the main track, they meet on the same frame: a track waits for the slowest of its group's tracks, a group for the slowest of the groups it meets, and each send waits on its own for the slowest send into the same return, whatever depth it leaves from.
Test: packages/core/src/audio/playback/mixer.test.ts "MIX-021"; apps/www/test/browser/arrangement-engine.check.ts "MIX-021"

### MIX-022 A meter in each track's header
A track's header meters what its channel sends on, after its volume, pan and switch, down its right edge, as a thin pair: a track that plays reads a level, and a silent or muted one reads none.
Test: apps/daw/test/browser/run.ts "MIX-022"

### MIX-016 The main track stays in sight
In the mixer, the main track stays whole at the right edge, apart from the channels by a line. One line parts two channels, returns included: no gap and no double line. The channels scroll beside it, never under it, and its fader starts level with theirs. The return tracks follow the tracks' channels and scroll with them.
Test: apps/daw/test/browser/run.ts "MIX-016"

### MIX-017 Moving a channel
A track's channel moves by its name: dragged, the others slide aside and it lands in the gap, a group with its tracks; or with Left and Right on it. Its row in the arrangement moves with it: there is one order. Returns and the main track stay where they are.
Test: apps/daw/test/browser/run.ts "MIX-017"

### MIX-018 A clip's title bar shows it
A click on a clip's title bar, not a drag of it, shows the clip in the clip view, whatever the panel showed: the mixer gives way to it. Picking a clip any other way, or moving it, leaves the mixer where it is.
Test: apps/daw/test/browser/run.ts "MIX-018"

### MIX-019 A channel's switches
A channel holds the same switches as its track's header, in one group: Solo, Mute and, for a track that records, an Arm light. Each is the same state as the header's: one moved, the other shows it.
Test: apps/daw/test/browser/run.ts "MIX-019"

### MIX-023 A channel's knobs turn by a vertical drag
A channel's pan and its sends are dragged up and down, as the reference's knobs are, and a drag across moves nothing; the wheel and the keys work as on every knob. The sends are small knobs, two to a row, all of them shown.
Test: apps/daw/test/browser/run.ts "MIX-023"

### MIX-024 A track with no output has no volume
A MIDI track with no instrument has no output, as in the reference: its channel has no sends, pan, fader or peak, and its header has no gain or pan. In automation mode its chooser lists only its devices' parameters, and a track with none has no chooser or envelope. Its switches stay, and its values are kept: a track given an instrument again has them as they were. A new MIDI track holds an instrument, so this shows when the instrument is removed.
Test: apps/daw/test/browser/run.ts "MIX-024"; apps/daw/test/devices.test.ts "MIX-024"

### MIX-025 The loudness of the mix
The main track's channel reads the mix's integrated loudness in LUFS (ITU-R BS.1770), under its fader, since it was last clicked: every 400 ms of the main track's sound after its volume, the quiet passages gated out (-70 LUFS, then 10 LU under the rest), so it agrees with the loudness an export of the same passage measures (EXP-010). It goes on while the transport is stopped, where silence counts for nothing.
Deviation: not in the reference manual's mixer. It reads the mix in the unit the export normalizes to (EXP-005).
Test: apps/www/test/registry-audio/base/lib/loudness.test.ts "createLoudnessReader"; apps/daw/test/browser/checks/mixer.ts "MIX-025"

### MIX-026 A device listens to another track
A device that takes a sidechain, the Ducker, has a Key from list in its title bar: its own sound, or any other track of clips. Picked, it follows that track's sound after its devices and before its volume and switch, so a kick muted to be heard only by the ducker still keys it, and the pad it is on turns down while the kick plays. A group, a return and its own track are not offered: none of them could key it without its sound feeding itself. One step of undo.
Test: apps/www/test/registry-audio/base/lib/arrangement-state.test.ts "MIX-026"; apps/www/test/browser/arrangement-engine.check.ts "MIX-026"; apps/daw/test/browser/checks/mixer.ts "MIX-026"
