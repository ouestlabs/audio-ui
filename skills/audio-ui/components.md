# Components

Docs for each: `https://www.audio-ui.dev/docs/components/base/<name>` (markdown: `/llm/components/base/<name>`).

## Where an installed component lives

`npx shadcn@latest add @audio-ui/<name>` copies the component to `components/audio-ui/<name>.tsx`. Import it from there:

```tsx
import { Knob } from "@/components/audio-ui/knob";
import { Meter } from "@/components/audio-ui/meter";
```

`@/components` is the `components` alias in the project's `components.json`: use the alias it declares. The CLI prints every file it writes; if a project installed components earlier, they may sit in another folder, so import from the path it printed. Components the one you add depends on (a block's knob, a plot's knob) land in the same folder. Hooks go to `hooks/`, libs to `lib/`, blocks to `components/examples/`.

Without the registry, the headless primitive comes from the package: `import { Knob } from "@audio-ui/react/knob"` (parts: `Knob.Root`, `Knob.Thumb`…).

## Elements

The pieces of any audio interface: controls, keyboards and displays. Each takes a value and reports changes, so it drives any engine.

### Controls

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `knob` | `Knob` from `@/components/audio-ui/knob` | `@audio-ui/react/knob` | A rotary parameter (level, cutoff, pan): circular, vertical or revolution drag, wheel, keyboard, double-click to reset |
| `fader` | `Fader` from `@/components/audio-ui/fader` | `@audio-ui/react/fader` | A linear slider for gain or any parameter, vertical or horizontal |
| `xypad` | `XYPad` from `@/components/audio-ui/xypad` | `@audio-ui/react/xypad` | Two parameters on one surface (filter cutoff and resonance, pan and send) |
| `envelope` | `Envelope` from `@/components/audio-ui/envelope` | `@audio-ui/react/envelope` | A ramp edited by breakpoints: ADSR and other shapes, drag points, bend segments |

### Keyboards and pads

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `piano` | `Piano` from `@/components/audio-ui/piano` | `@audio-ui/react/piano` | A virtual keyboard with a MIDI pitch range, glissando, multi-touch, an `activeNotes` overlay |
| `pad` | `Pad`, `PadItem` from `@/components/audio-ui/pad` | `@audio-ui/react/pad` | Drum pads to strike (on pointer down, so press them, don't `click`; `onPadOn(value, { velocity })` and `onPadOff(value)` carry the strike): velocity from pressure or height, `chokeGroup` to cut a ringing pad, `Space` or `Enter` on the focused pad, an `activePads` overlay |
| `midi-connect-control` | `MidiConnectControl` from `@/components/audio-ui/midi-connect-control` | registry only | A button that connects the page's MIDI input, with the device's name beside it. Its `use-midi-input` hook gives the held notes (for `activeNotes`), note-on with velocity from 0 to 1, note-off and pitch bend |

### Displays

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `meter` | `Meter` from `@/components/audio-ui/meter` | `@audio-ui/react/meter` | Stereo or multi-channel dB level with peak hold, display only. Live levels come from a `source`, not from React state: `useAudioLevels(analysers)` from the `use-audio-levels` hook makes one |
| `needle-meter` | `NeedleMeter` from `@/components/audio-ui/needle-meter` | registry only | A VU meter to the standard (ANSI C16.5, IEC 60268-17): the dial from -20 to +3 VU with its marks spread by voltage, and a needle with the 300 ms ballistics. It follows the first channel of a `source`, like `meter`; `reference` is the level in dB that reads 0 VU, -18 by default |
| `waveform` | `Waveform`, `WaveformRegion`, `WaveformMarker`, `LiveWaveform`, `BarVisualizer` from `@/components/audio-ui/waveform` | `@audio-ui/react/waveform` | A seekable waveform with regions and markers, a live scrolling one, or a bar visualizer (`waveform-peaks` lib turns a file into peaks) |
| `spectrum-analyzer` | `SpectrumAnalyzer` from `@/components/audio-ui/spectrum-analyzer` | registry only, built on `Plot` | A live spectrum on a log frequency axis with held peaks. Feed it `useSpectrum(analyser)` from the `use-spectrum` hook, with the same `minHz`/`maxHz` |
| `tuner` | `Tuner` from `@/components/audio-ui/tuner` | registry only | A chromatic tuner's display: the nearest note, a needle on a scale of cents and the frequency, in the primary color when in tune. It follows a `source`: `usePitch(analyser)` from `use-pitch`, fed by `useMicrophone()` (start it from a click) or any `AnalyserNode` |
| `plot` | `Plot`, `PlotGraph`, `PlotCurve`, `PlotHandle`, `PlotTraceArea`… from `@/components/audio-ui/plot` | `@audio-ui/react/plot` | A curve with draggable points: equalizers, filters, compressors |

## Workstation

The surfaces of a DAW: the arrangement, the editors, the piano roll's tools, the transport and the mixing. They are controlled and engine-agnostic: notes, clips and positions come in as values and live sources, edits go out through callbacks, so they work over audio/ui's Web Audio hooks or over an engine of your own (an AudioWorklet, WASM).

### Arrangement

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `timeline` | `Timeline`, `TimelineRuler`, `TimelineTrack`, `TimelineClip`, `TimelinePlayhead`… from `@/components/audio-ui/timeline` | `@audio-ui/react/timeline` | A zoomable arrangement view: ruler that seeks on the grid, lanes, a playhead that moves without re-rendering (`musical-time` lib converts tempo to seconds) |
| `arrangement-editor` | installs the parts below with `timeline`: `useArrangement` from `@/hooks/use-arrangement` and the pure side from `@/lib/arrangement` | registry only | A DAW's arrangement: tracks of clips with selection, group moves, split, time commands, mix, automation, undo. `block-timeline` wires it into a screen |
| `arranged-clip` | `ArrangedClip`, `ArrangedClipGhost` from `@/components/audio-ui/arranged-clip`, `useArrangedClips` from `@/hooks/use-arranged-clips` | registry only | A clip of the arrangement on its lane: move, trim, fade and its curves, rename in place, its menu; a MIDI clip draws its notes. The hook wires it to the arrangement's commands: `clipProps(clip)`, `ghostsOn(trackId)` |
| `timeline-markers` | `TimelineLocator`, `TimelineSignature`, `TimelineBarMarks` from `@/components/audio-ui/timeline-markers`, `useTimelineMarkers` from `@/hooks/use-timeline-markers` | registry only | Locators to jump to and time-signature changes, in a `TimelineMark`: rename or retype in place, move, delete; the bars of a ruler through those changes; the hook holds the commands behind them |
| `use-timeline-cursor` | `useTimelineCursor` from `@/hooks/use-timeline-cursor` | registry only | The cursor's keys: `handleArrowKey` (arrows on the grid, Home, End, Up and Down to pick a track) and `handleKey` (Alt and the arrows between locators and clip edges, M adds a locator) |
| `track-level` | `TrackLevel` from `@/components/audio-ui/track-level` | registry only | A track's level for its header, given to `TimelineTrackControls`' `meter`: a thin vertical meter of the analysers the engine has for the track, silent until an engine runs |
| `track-automation` | `TrackAutomationChooser`, `TrackAutomation`, `deviceTargets` from `@/components/audio-ui/track-automation`, `useTrackAutomation`, `useAutomatedMix`, `useAutomatedDevice`, `useAutomatedRack` from `@/hooks/use-track-automation` | registry only | An envelope over a track's lane, of its volume, its pan or a parameter of its devices and racks' macros, and the chooser for its header; the hook holds automation mode and what was moved by hand (`overridden`, for the engine; `deviceMoved` for a device's parameters) until `reenable` |
| `use-track-reorder` | `useTrackReorder` from `@/hooks/use-track-reorder`, `TrackGrip`, `TrackReorderGhost`, `trackReorderClass` from `@/components/audio-ui/track-grip` | registry only | Reorder tracks by dragging a grip (a ghost under the pointer, edge scrolling) or with Up and Down: `gripProps(id)`, `drop`, `ghost`, and the grip, the ghost and the drop line to draw them |
| `use-time-selection` | `useTimeSelection` from `@/hooks/use-time-selection`, `TimelineTimeSelection` from `@/components/audio-ui/time-selection` | registry only | A stretch of time on some tracks, dragged across bare lanes: `pressLane`, `onSelectionChange`, `time`, the overlay to draw it, and `handleKey` for copy, cut, paste, duplicate, consolidate, loop, fade, delete and open time |
| `use-timeline-zoom` | `useTimelineZoom` from `@/hooks/use-timeline-zoom` | registry only | A timeline's zoom: fitted beside the track headers until zoomed, `zoomAround(at, factor)`, `zoomTo(start, end)`, `zoomBack()`, `rescale(ratio)` on a tempo change; spread `timeline` on `Timeline` |
| `use-timeline-grid` | `useTimelineGrid`, `GRID_KEYS`, `GRID_DIVISION_OPTIONS` from `@/hooks/use-timeline-grid` | registry only | A timeline's grid: adaptive or fixed, triplet, snap, `step` to draw, `snapStep` to snap to, `label` for its menu button, `change` for Cmd/Ctrl + 1 to 5 |
| `use-midi-playback` | `useMidiPlayback` from `@/hooks/use-midi-playback` | registry only | Play an arrangement's MIDI clips on the audio clock, a channel per track following its mix or automation; `onNoteOn`/`onNoteOff` for a clip's editor |

### Editors

The piano roll and the sequencer, with what plays and undoes them.

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `piano-roll` | `PianoRoll`, `PianoRollKeys`, `PianoRollGrid`, `PianoRollVelocity`… from `@/components/audio-ui/piano-roll` | `@audio-ui/react/piano-roll` | A DAW-style note editor: grid, keyboard, a velocity or chance lane (a brush in draw mode), a `scale` it marks and folds onto, painted drawing, stretch handles on the selection, and keyboard editing |
| `sequencer` | `Sequencer` from `@/components/audio-ui/sequencer` | `@audio-ui/react/sequencer` | A step grid: press a step to flip it (on pointer down, so press it, don't `click`), drag across steps to paint a pattern, `Space` or `Enter` on the focused step. The playing step comes from a `source`, not state |
| `midi-file` | `readMidiFile`, `writeMidiFile`, `downloadMidiFile`, `MIDI_FILE_ACCEPT` from `@/lib/midi-file` | registry only | Import a `.mid` file onto the roll's steps, with its tempo, and export or download the notes as one |
| `use-piano-roll-playback` | `usePianoRollPlayback`, `meterOf` from `@/hooks/use-piano-roll-playback` | registry only | Play the notes you hold, through `use-synth-voices`: play, pause, stop, loop, metronome, seek, a `position` for the timeline, a `clock` for the transport, and the roll's `onNoteOn` and `onNoteOff` |
| `use-undo-history` | `useUndoHistory` from `@/hooks/use-undo-history` | registry only | Undo and redo over any value you hold: `edit` for a command, `change` and `commit` for a drag that undoes as one |

### Piano roll tools

The parts of `block-piano-roll`, each installed on its own.

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `scale-menu` | `ScaleMenu`, `ScaleMenuTrigger`, `ScaleMenuContent`, `ScaleMenuToggle`, `ScaleMenuRoot`, `ScaleMenuName` from `@/components/audio-ui/scale-menu` | registry only | Pick a root and a scale and turn it on or off. Pass `enabled ? scale : null` to the roll's `scale`. Items of your own go in the content beside the parts |
| `note-find` | `NoteFind`, `NoteFindForm` from `@/components/audio-ui/note-find` | registry only | Find notes by pitch, scale, state, velocity, length, chance or every few: `onFind` gets a query, `findNotes(notes, query)` from `@audio-ui/core/piano-roll` the ids to select |
| `note-edit-menu` | `NoteEditMenu`, `NoteEditMenuTrigger`, `NoteEditMenuContent`, `NoteEditMenuItems`, `NoteEditMenuSub` from `@/components/audio-ui/note-edit-menu`; the commands, `TIME_EDITS`, `PITCH_EDITS`, `PLAY_EDITS`, `VELOCITY_EDITS`, `applyNoteEdit`, `canApplyNoteEdit`, `noteEditForKey`, from `@/lib/note-edits`, which it installs too | registry only | A menu of note commands (split, join, quantize, legato, time commands, fit to scale, chance, velocity) with their keys, as items or submenus, beside items of your own (import, export, clear). The commands are data, so keys or a toolbar run them too |

### Transport

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `transport` | `Transport` from `@/components/audio-ui/transport` | registry only | Play or pause, stop, the position in bars, beats and sixteenths, tempo and time signature, and loop and metronome toggles when you pass their handlers. The position follows a `source`, so a playing transport does not re-render |
| `bpm-control` | `BpmControl` from `@/components/audio-ui/bpm-control` | registry only | A tempo field on its own: type it, step it with the arrows, or drag its `BPM` unit. `transport` brings it |
| `scrubber` | `Scrubber` from `@/components/audio-ui/scrubber` | registry only, built on `Timeline` | Play or pause, position, a seek bar and the length |

### Mixing

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `device-chain` | `DeviceChain`, `DeviceChainSlot`, `DeviceChainSlotControls`, `DeviceChainAdd`, `DEVICE_DRAG_TYPE` from `@/components/audio-ui/device-chain` | registry only | A track's devices in a row, each drawn by its own panel with `DeviceChainSlotControls` at the end of its header: drag by the header or the grip, Left and Right on the grip, Delete, fold, and a device dropped from a library. Controlled by `order` with `onMove(id, index)`, `onRemove(id)` and `onAdd(device, index)`; no audio in it |
| `device-browser` | `DeviceBrowser` from `@/components/audio-ui/device-browser` | registry only | A library of devices by shelf with a search: `onPick(id)` on Enter, a double-click or the Add button, or a drag onto a `device-chain`. A device definition is an item as it is (`id`, `name`, `description`) |
| `device-panels` | `devicePanel`, `DEVICE_PANELS` from `@/components/audio-ui/device-panels` | Every device's own panel by its stable id (`audioui.compressor`), with its width in a row: draw a track's chain from the ids a project stores |

## Devices

Audio effects and instruments, like plugins in a DAW. A device is a state (`<name>-device`), an engine (`<name>-engine`) and a face (`<name>-panel`), installed to `components/audio-ui/devices/<name>/`. `npx shadcn@latest add @audio-ui/<name>` installs all three (`@audio-ui/compressor`, `@audio-ui/reverb`…); install a piece alone to keep only what you need, such as the state and the panel over an engine of your own. A panel is controlled and makes no sound, so it also fronts an engine of your own. Docs: https://www.audio-ui.dev/docs/devices.

| Name | Registry import | Package import | Use it for |
| --- | --- | --- | --- |
| `device-panel` | `DevicePanel` from `@/components/audio-ui/device-panel` | registry only | A panel for any `defineDevice` device: a knob per number and a toggle per switch, from its descriptors. Controlled: `value` and `onValueChange(state)`; it keeps no state |
| `compressor-panel` | `CompressorPanel` from `@/components/audio-ui/devices/compressor/panel` | registry only | The compressor device's face: the transfer curve it plays, with the threshold and the level going in, over its knobs. Pair it with the `compressor-device` and `compressor-engine` libs |
| `equalizer-panel` | `EqualizerPanel` from `@/components/audio-ui/devices/equalizer/panel` | registry only | The equalizer device's face: the curve of its four bands with a handle on each to drag its frequency and gain, an optional live spectrum behind it, over its knobs. Pair it with the `equalizer-device` and `equalizer-engine` libs |
| `delay-panel` | `DelayPanel` from `@/components/audio-ui/devices/delay/panel` | registry only | The delay device's face: the echoes it makes with a handle for the time and the feedback. Pair it with the `delay-device` and `delay-engine` libs |
| `reverb-panel` | `ReverbPanel` from `@/components/audio-ui/devices/reverb/panel` | registry only | The reverb device's face: the tail it makes with a handle for the decay time. Pair it with the `reverb-device` and `reverb-engine` libs |
| `filter-panel` | `FilterPanel` from `@/components/audio-ui/devices/filter/panel` | registry only | The filter device's face: the curve it plays with a handle for the cutoff and the resonance, over an optional live spectrum. Pair it with the `filter-device` and `filter-engine` libs |
| `distortion-panel` | `DistortionPanel` from `@/components/audio-ui/devices/distortion/panel` | registry only | The distortion device's face: its transfer curve against a clean sound. Pair it with the `distortion-device` and `distortion-engine` libs |
| `chorus-panel` | `ChorusPanel` from `@/components/audio-ui/devices/chorus/panel` | registry only | The chorus device's face: the sweep of its delay. Pair it with the `chorus-device` and `chorus-engine` libs |
| `pocket-synth-panel` | `PocketSynthPanel` from `@/components/audio-ui/devices/pocket-synth/panel` | registry only | The pocket synth device's face: a pad that plays it, its waveform and filter and its volume. Pair it with the `pocket-synth-device` and `pocket-synth-engine` libs |
| `wave-shaper-panel` | `WaveShaperPanel` from `@/components/audio-ui/devices/wave-shaper/panel` | registry only | The wave shaper device's face: a pad that plays it, its waveform and its knobs. Pair it with the `wave-shaper-device` and `wave-shaper-engine` libs |
| `utility-panel` | `UtilityPanel` from `@/components/audio-ui/devices/utility/panel` | registry only | The utility device's face: its gain, pan and width as knobs and its mono and invert switches. Pair it with the `utility-device` and `utility-engine` libs |
| `limiter-panel` | `LimiterPanel` from `@/components/audio-ui/devices/limiter/panel` | registry only | The limiter device's face: its transfer curve with a handle for the ceiling and the input gain. Pair it with the `limiter-device` and `limiter-engine` libs |
| `gate-panel` | `GatePanel` from `@/components/audio-ui/devices/gate/panel` | registry only | The gate device's face: its transfer curve with a handle on the threshold. Pair it with the `gate-device` and `gate-engine` libs |
| `saturator-panel` | `SaturatorPanel` from `@/components/audio-ui/devices/saturator/panel` | registry only | The saturator device's face: its transfer curve and the choice of curve. Pair it with the `saturator-device` and `saturator-engine` libs |
| `phaser-panel` | `PhaserPanel` from `@/components/audio-ui/devices/phaser/panel` | registry only | The phaser device's face: the sweep of its oscillator, with the knobs the mode does not use drawn off. Pair it with the `phaser-device` and `phaser-engine` libs |
| `auto-pan-panel` | `AutoPanPanel` from `@/components/audio-ui/devices/auto-pan/panel` | registry only | The auto pan device's face: what its oscillator does to the pan or the level. Pair it with the `auto-pan-device` and `auto-pan-engine` libs |
| `channel-eq-panel` | `ChannelEqPanel` from `@/components/audio-ui/devices/channel-eq/panel` | registry only | The channel eq device's face: its curve with a handle on the mid band, over the shelf knobs and the high-pass switch. Pair it with the `channel-eq-device` and `channel-eq-engine` libs |
| `overdrive-panel` | `OverdrivePanel` from `@/components/audio-ui/devices/overdrive/panel` | registry only | The overdrive device's face: the band that reaches the clip with a handle on its centre. Pair it with the `overdrive-device` and `overdrive-engine` libs |
| `deesser-panel` | `DeesserPanel` from `@/components/audio-ui/devices/deesser/panel` | registry only | The de-esser device's face: what it does at each frequency with a handle on the frequency and the range. Pair it with the `deesser-device` and `deesser-engine` libs |
| `multiband-panel` | `MultibandPanel` from `@/components/audio-ui/devices/multiband/panel` | registry only | The multiband compressor device's face: the three bands against frequency with a handle on each split. Pair it with the `multiband-device` and `multiband-engine` libs |
| `transient-panel` | `TransientPanel` from `@/components/audio-ui/devices/transient/panel` | registry only | The transient shaper device's face: a square with the sustain across and the attack up and one handle for both. Pair it with the `transient-device` and `transient-engine` libs |
| `mid-side-panel` | `MidSidePanel` from `@/components/audio-ui/devices/mid-side/panel` | registry only | The mid/side device's face: a square with the side across and the mid up and one handle for both. Pair it with the `mid-side-device` and `mid-side-engine` libs |
| `redux-panel` | `ReduxPanel` from `@/components/audio-ui/devices/redux/panel` | registry only | The redux device's face: the stairs the bits make against a clean sound. Pair it with the `redux-device` and `redux-engine` libs |

## Audio engine

What makes the sound, on the Web Audio API: install each on its own, to `hooks/` or `lib/`. All optional: the components take values and live sources, so an engine of your own (an AudioWorklet, WASM) drives them the same way, through `createSource` from `@audio-ui/react`. Docs: https://www.audio-ui.dev/docs/engine.

| Name | Import | Use it for |
| --- | --- | --- |
| `web-audio` | `webAudio` from `@/lib/web-audio` | The page's one `AudioContext`: `webAudio.getContext()`, `null` on the server. Resume it from the click that starts the sound |
| `use-master-bus` | `useMasterBus` from `@/hooks/use-master-bus` | One gain and a safety limiter that every sound of a screen connects into, set by one volume |
| `use-transport-clock` | `useTransportClock` from `@/hooks/use-transport-clock` | Schedule notes ahead on the audio clock: `onStep(step, time)` on each step, a loop region, seek with `reanchor`, `getPosition` for a playhead |
| `clip-player` | `loadClipPlayer`, `createClipPlayer` from `@/lib/clip-player` | A track's audio clips played to the frame on the audio clock, in an AudioWorklet: `setClips(playedClips(...), recordings)`, `schedule(state)` with a `PlaybackState` from `@audio-ui/core/playback`, `synced()` before an offline render |
| `arrangement-engine` | `useArrangementEngine` from `@/hooks/use-arrangement-engine`, `renderArrangement` from `@/lib/arrangement-engine` | Play the document of `useArrangement` on the audio clock: audio clips, notes through each MIDI track's instrument, device chains, sends, returns and the main track; `play(from)`, `stop()`, `position` (a live source of seconds), `meter(id)`, `status`, a `metronome` option on the audio clock that an export never has; `renderArrangement` for an offline render |
| `mixer-engine` | `createMixer` from `@/lib/mixer-engine` | A mixing desk of your own sources: a channel per track and return with a chain, volume, constant-power pan, switch, solo, pre or post-fader sends, delay compensation and meters |
| `device-library` | `libraryDevice`, `DEVICE_LIBRARY`, `DEVICE_SHELVES` from `@/lib/device-library` | Every device with its engine, by its stable id (`audioui.compressor`): turn a project's device ids into engines, list them in a browser |
| `use-synth-voices` | `useSynthVoices` from `@/hooks/use-synth-voices` | Polyphonic voices shaped by an `Envelope`'s points: `triggerNote`, `releaseNote`, `releaseAll`, `setPitchBend` |
| `envelope-ramp` | `scheduleEnvelopeRamp`, `sliceEnvelope` from `@/lib/envelope-ramp` | An envelope's points as a gain ramp on any `AudioParam` |
| `drum-synthesis` | `triggerKick`, `triggerSnare`, `triggerHihat` from `@/lib/drum-synthesis` | Drum hits from oscillators and noise, no samples: `triggerKick(ctx, destination, time, { tune, decay })`, the same for `triggerSnare` and `triggerHihat`, with `time` on the audio clock |
| `use-midi-input` | `useMidiInput` from `@/hooks/use-midi-input` | The page's MIDI keyboard: note on with velocity, note off, pitch bend, `activeNotes` for a piano. Connect from a click |
| `use-microphone` | `useMicrophone` from `@/hooks/use-microphone` | The microphone as an `AnalyserNode`, raw, never played out. Start it from a click |
| `use-audio-levels` | `useAudioLevels` from `@/hooks/use-audio-levels` | Live levels and peaks from one analyser per channel, for a `Meter`'s `source`. Memoize the array |
| `use-spectrum` | `useSpectrum`, `useSpectrumPeaks` from `@/hooks/use-spectrum` | A live spectrum on a log axis, for a `SpectrumAnalyzer` or a `PlotTrace` |

## More pieces

| Name | Import | Use it for |
| --- | --- | --- |
| `waveform-select` | `WaveformSelect` from `@/components/audio-ui/waveform-select` | A row of buttons, one per waveform, each drawn as its shape |
| `filter-type-select` | `FilterTypeSelect` from `@/components/audio-ui/filter-type-select` | A row of buttons, one per filter type, each drawn as its response |
| `curve-select` | `CurveSelect` from `@/components/audio-ui/curve-select` | A row of buttons, one per transfer curve, each drawn from the function you give it |
| `play-toggle` | `PlayToggle` from `@/components/audio-ui/play-toggle` | A play and pause button for a demo signal: feed it `usePlaySwitch()` inside an `AudioSessionProvider` to start a device's loop |
| `automation-envelope` | `AutomationEnvelope` from `@/components/audio-ui/automation-envelope` | A track's automation over its lane in a timeline, under the same zoom and scroll as the clips |
| `clip-view`, `clip-panel`, `midi-clip-panel` | from `@/components/audio-ui/<name>` | The detail view of an arrangement's audio or MIDI clip: its strip, start and end, loop, and the waveform or notes |
| `use-marquee-selection` | `useMarquee` from `@/hooks/use-marquee-selection` | A selection rectangle for the clips of a timeline |
| `use-audio-signal` | `useAudioSignal` from `@/hooks/use-audio-signal` | An `AnalyserNode` as live signals for a waveform: loudest sample, frequency bands, raw samples |
| `use-simulated-clock`, `use-simulated-levels`, `use-play-switch` | from `@/hooks/<name>` | A clock, levels and a play switch for a demo that makes no sound |
| `use-audio-session` | `AudioSessionProvider` from `@/hooks/use-audio-session` | A play switch and a microphone switch of their own for a demo and its controls: inside one, `use-play-switch` and `use-microphone` follow it; outside one they stay off |
| `use-demo-source` | `useDemoSource` from `@/hooks/use-demo-source` | The sound a device plays: the one chosen in its session, else its default from `DEMO_SOURCES` (`@/lib/demo-sound`) |
| `use-device-loop`, `use-noise-through-eq`, `use-pulses-through-compressor` | `useDeviceLoop` and the others from `@/hooks/<name>` | A short loop of drums and plucked notes through an effect's engine, pink noise through an equalizer, or pulses through a compressor: what a device does, heard and measured. They play while the play switch of their `AudioSessionProvider` is on, and stay silent outside one |
| `audio-decode` | `decodeAudioChannels` from `@/lib/audio-decode` | Decode an audio file into samples before `computePeaks` |
| `rack-panel` | `RackPanel`, and its parts `RackFrame`, `RackMacros`, `RackChainRow`, from `@/components/audio-ui/rack-panel` | The face of a rack: eight macro knobs with a menu to map parameters of the devices inside, its chains with volume, switch and solo, and the picked chain's devices as children; with `onZoneChange`, a Zones switch shows each chain's keys and velocities |
| `drum-rack-panel` | `DrumRackPanel` from `@/components/audio-ui/drum-rack-panel` | The face of a drum rack: the rack's macros, sixteen pads on a bank of the 128 notes that play when struck and take a recording dropped on them, the picked pad's voice, tune, decay and mix, and its devices as children |
| `rack` | `createRackEngine`, `macroPositions`, `rackLatency`, `heardChains` from `@/lib/rack`; `RACK_DEVICE`, `newRack` from `@/lib/arrangement` | Devices in parallel chains with their own volume, pan, switch and solo, lined up on the slowest and summed, and eight macros over the parameters inside: what plays a rack on a track's chain |
| `drum-rack` | `createDrumRackEngine`, `padsOf` from `@/lib/drum-rack`; `DRUM_RACK_DEVICE`, `newDrumRack`, `DRUM_DECAYS`, `padRecordings`, `renamePadRecordings` from `@/lib/arrangement` | An instrument of pads: each chain answers a note with a voice of the drum synthesis or a recording, pitched and cut to a decay, into its own devices, summed as a rack with its macros; a note player |
| `instrument-rack` | `createInstrumentRackEngine`, `chainInstrument` from `@/lib/instrument-rack`; `INSTRUMENT_RACK_DEVICE`, `inZone`, `FULL_ZONE` from `@/lib/arrangement` | An instrument whose chains each start with an instrument of the library, then effects, played by the notes in each chain's zone of keys and velocities, in layers and summed as a rack with its macros |
| `voice-pool` | `createVoicePool`, `noteParameters`, `NotePlayer`, `PlayedNote` from `@/lib/voice-pool` | What a MIDI track plays through, all taking notes the same way (`noteOn(note, time, id)`, `noteOff`, `release`), and an instrument of the library played with a voice per held note |
| `dawproject` | `exportDawproject`, `importDawproject`, `writeDawproject`, `readDawproject` from `@/lib/dawproject`; `createZip`, `readZip` from `@/lib/zip` | Send an arrangement to other DAWs as a `.dawproject` file and open one of theirs, the open exchange format: tracks, mix, sends, clips, notes, volume and pan automation, locators, tempo, time signatures, and the equalizer, compressor, gate and limiter; a report lists what was left out |
| `wav-file` | `encodeWav`, `downloadWavFile` from `@/lib/wav-file` | Save rendered sound as a WAV file, 16 or 24-bit, normalized or not: what an `OfflineAudioContext` renders |
| `key-detector`, `oversampling`, `synced-rate`, `demo-sound`, `device-measure` | from `@/lib/<name>` | The engine pieces of the devices: a key detector worklet, oversampled waveshaping, a tempo-synced rate, the demo sounds by name (a boom bap loop and a drone), measuring an engine against its panel |
| `piano-roll-tools` | `createPianoRollTools` from `@/lib/piano-roll-tools` | Typed tools an AI model uses to edit a piano roll |

## Ready blocks

`npx shadcn@latest add @audio-ui/block-<name>` installs a composed screen to `components/examples/block-<name>.tsx`, exported by name:

```tsx
import { BlockPocketSynth } from "@/components/examples/block-pocket-synth";
```

Available today: `block-pocket-synth`, `block-wave-shaper`, `block-waveform-player`, `block-piano-roll`, `block-timeline`, `block-drum-rack`, `block-mixer`, `block-device-chain`, `block-compressor`, `block-equalizer`, `block-delay`, `block-reverb`, `block-filter`, `block-distortion`, `block-chorus`, `block-utility`, `block-limiter`, `block-gate`, `block-saturator`, `block-phaser`, `block-auto-pan`, `block-channel-eq`, `block-overdrive`, `block-redux`, `block-deesser`, `block-multiband`, `block-transient`, `block-mid-side`. The full catalog (with demos) is at https://www.audio-ui.dev/components, or ask the MCP `search_catalog` tool.
