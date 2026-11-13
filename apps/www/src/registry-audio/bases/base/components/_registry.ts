import type { RegistryItem } from "shadcn/schema";

export const components: RegistryItem[] = [
  {
    categories: ["synth", "hardware", "parameter-field"],
    description:
      "A small synth's panel with every audio control together: Power plays an arpeggio at the tempo through the oscillator's waveform, a low-pass filter (cutoff and resonance knobs), the gain and the transpose fields, into the master fader; the screen shows the value last touched, the LED lights on each beat",
    files: [
      {
        path: "components/synth/block-synth-panel.tsx",
        type: "registry:block",
      },
    ],
    name: "block-synth-panel",
    registryDependencies: [
      "@audio-ui/fader",
      "@audio-ui/knob",
      "@audio-ui/lcd",
      "@audio-ui/led",
      "@audio-ui/parameter-field",
      "@audio-ui/rocker-switch",
      "@audio-ui/value-display",
      "@audio-ui/waveform-select",
      "@audio-ui/use-master-bus",
      "@audio-ui/web-audio",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "xypad"],
    dependencies: ["@audio-ui/react"],
    description:
      "A synth you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file. Press the pad: pitch goes across, the filter cutoff up",
    files: [
      {
        path: "components/device/block-pocket-synth.tsx",
        type: "registry:block",
      },
    ],
    name: "block-pocket-synth",
    registryDependencies: [
      "@audio-ui/pocket-synth-panel",
      "@audio-ui/pocket-synth-device",
      "@audio-ui/pocket-synth-engine",
      "@audio-ui/use-device-engines",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "An eighties polyphonic synth you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file, eight voices for chords. Play the keyboard, or a MIDI keyboard",
    files: [
      {
        path: "components/device/block-poly-synth.tsx",
        type: "registry:block",
      },
    ],
    name: "block-poly-synth",
    registryDependencies: [
      "@audio-ui/poly-synth-panel",
      "@audio-ui/poly-synth-device",
      "@audio-ui/poly-synth-engine",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-polyphony",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A monophonic analog synth you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file, one note at a time that glides to the next. Play the keyboard, or a MIDI keyboard",
    files: [
      {
        path: "components/device/block-mono-synth.tsx",
        type: "registry:block",
      },
    ],
    name: "block-mono-synth",
    registryDependencies: [
      "@audio-ui/mono-synth-panel",
      "@audio-ui/mono-synth-device",
      "@audio-ui/mono-synth-engine",
      "@audio-ui/use-device-engines",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A tonewheel organ you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file, eight voices for chords. Play the keyboard, or a MIDI keyboard",
    files: [
      {
        path: "components/device/block-organ.tsx",
        type: "registry:block",
      },
    ],
    name: "block-organ",
    registryDependencies: [
      "@audio-ui/organ-panel",
      "@audio-ui/organ-device",
      "@audio-ui/organ-engine",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-polyphony",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A string machine you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file, eight voices for chords. Play the keyboard, or a MIDI keyboard",
    files: [
      {
        path: "components/device/block-string-machine.tsx",
        type: "registry:block",
      },
    ],
    name: "block-string-machine",
    registryDependencies: [
      "@audio-ui/string-machine-panel",
      "@audio-ui/string-machine-device",
      "@audio-ui/string-machine-engine",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-polyphony",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A tape-replay keyboard you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file, eight keys for chords. Play its 35 keys, or a MIDI keyboard from G2 to F5",
    files: [
      {
        path: "components/device/block-tape-keys.tsx",
        type: "registry:block",
      },
    ],
    name: "block-tape-keys",
    registryDependencies: [
      "@audio-ui/tape-keys-panel",
      "@audio-ui/tape-keys-device",
      "@audio-ui/tape-keys-engine",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-polyphony",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A plucked guitar: its panel and its engine, eight strings for chords, played from the keyboard or a MIDI keyboard.",
    files: [
      {
        path: "components/device/block-guitar.tsx",
        type: "registry:block",
      },
    ],
    name: "block-guitar",
    registryDependencies: [
      "@audio-ui/guitar-panel",
      "@audio-ui/guitar-device",
      "@audio-ui/guitar-engine",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-polyphony",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "pad"],
    dependencies: [],
    description:
      "A synthesized drum: its panel and its engine, struck from its pad, a MIDI keyboard or a pad controller, as hard as you like.",
    files: [
      {
        path: "components/device/block-drum-synth.tsx",
        type: "registry:block",
      },
    ],
    name: "block-drum-synth",
    registryDependencies: [
      "@audio-ui/drum-synth-panel",
      "@audio-ui/drum-synth-device",
      "@audio-ui/drum-synth-engine",
      "@audio-ui/use-device-engines",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/web-audio",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "An eighties four-operator FM synth you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file, eight voices for chords. Play the keyboard, or a MIDI keyboard",
    files: [
      {
        path: "components/device/block-fm-synth.tsx",
        type: "registry:block",
      },
    ],
    name: "block-fm-synth",
    registryDependencies: [
      "@audio-ui/fm-synth-panel",
      "@audio-ui/fm-synth-device",
      "@audio-ui/fm-synth-engine",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-polyphony",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "pad"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A slice sampler you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file. Strike its sixteen pads, play a MIDI keyboard from C2, or drop an audio file on it",
    files: [
      {
        path: "components/device/block-sampler.tsx",
        type: "registry:block",
      },
    ],
    name: "block-sampler",
    registryDependencies: [
      "@audio-ui/sampler-panel",
      "@audio-ui/sampler-device",
      "@audio-ui/sampler-engine",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-polyphony",
      "@audio-ui/web-audio",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A tine electric piano you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file, ten voices for chords. Play the keyboard, or a MIDI keyboard: a hard key barks and pings",
    files: [
      {
        path: "components/device/block-electric-piano.tsx",
        type: "registry:block",
      },
    ],
    name: "block-electric-piano",
    registryDependencies: [
      "@audio-ui/electric-piano-panel",
      "@audio-ui/electric-piano-device",
      "@audio-ui/electric-piano-engine",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-polyphony",
    ],
    type: "registry:block",
  },
  {
    categories: ["instrument", "synth", "xypad"],
    dependencies: ["@audio-ui/react"],
    description:
      "A wave shaper synth you can plug in: its state, a panel that draws and plays it and a Web Audio engine that makes the sound, each its own file. Press the pad: pitch goes across, the resonance up",
    files: [
      {
        path: "components/device/block-wave-shaper.tsx",
        type: "registry:block",
      },
    ],
    name: "block-wave-shaper",
    registryDependencies: [
      "@audio-ui/wave-shaper-panel",
      "@audio-ui/wave-shaper-device",
      "@audio-ui/wave-shaper-engine",
      "@audio-ui/use-device-engines",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["fader"],
    description: "Vertical fader",
    files: [
      {
        path: "components/fader/fader-vertical-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-vertical-demo",
    registryDependencies: ["@audio-ui/fader"],
    type: "registry:example",
  },
  {
    categories: ["fader"],
    description:
      "Pan fader filling from the center: anchored at 0 on a -1…1 range",
    files: [
      {
        path: "components/fader/fader-pan-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-pan-demo",
    registryDependencies: ["@audio-ui/fader"],
    type: "registry:example",
  },
  {
    categories: ["hardware"],
    description: "LEDs lit by Rec and Mute, one blinking red, in three sizes",
    files: [
      {
        path: "components/hardware/led-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "led-demo",
    registryDependencies: ["@audio-ui/led", "@shadcn/button"],
    type: "registry:example",
  },
  {
    categories: ["hardware"],
    description:
      "Screens with a caption: a filter cutoff in kHz driven by a parameter field, a preset's name and a tempo",
    files: [
      {
        path: "components/hardware/lcd-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "lcd-demo",
    registryDependencies: [
      "@audio-ui/lcd",
      "@audio-ui/value-display",
      "@audio-ui/parameter-field",
    ],
    type: "registry:example",
  },
  {
    categories: ["hardware"],
    description:
      "A value of each kind: tempo, gain, cutoff, pan, mix, transpose and position",
    files: [
      {
        path: "components/hardware/value-display-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "value-display-demo",
    registryDependencies: ["@audio-ui/value-display"],
    type: "registry:example",
  },
  {
    categories: ["hardware"],
    description:
      "A power rocker that lights its LED, a small one laid down, and one disabled",
    files: [
      {
        path: "components/hardware/rocker-switch-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "rocker-switch-demo",
    registryDependencies: ["@audio-ui/rocker-switch", "@audio-ui/led"],
    type: "registry:example",
  },
  {
    categories: ["parameter-field"],
    description:
      "Parameter fields for tempo, gain, transpose and cutoff: typed, stepped, or scrubbed by their label or unit",
    files: [
      {
        path: "components/parameter-field/parameter-field-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "parameter-field-demo",
    registryDependencies: ["@audio-ui/parameter-field"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob component example",
    files: [
      {
        path: "components/knob/knob-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-demo",
    registryDependencies: ["@audio-ui/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description:
      "Filter cutoff knob on a logarithmic scale, 20 Hz to 20 kHz, every decade the same share of the dial",
    files: [
      {
        path: "components/knob/knob-filter-control-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-filter-control-demo",
    registryDependencies: ["@audio-ui/knob"],
    type: "registry:example",
  },
  {
    categories: ["envelope"],
    description: "Envelope size default example",
    files: [
      {
        path: "components/envelope/envelope-size-default-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "envelope-size-default-demo",
    registryDependencies: ["@audio-ui/envelope"],
    type: "registry:example",
  },
  {
    categories: ["envelope"],
    description: "Controlled envelope with a live point count",
    files: [
      {
        path: "components/envelope/envelope-adsr-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "envelope-adsr-demo",
    registryDependencies: ["@audio-ui/envelope"],
    type: "registry:example",
  },
  {
    categories: ["piano"],
    description: "Piano size default example",
    files: [
      {
        path: "components/piano/piano-size-default-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "piano-size-default-demo",
    registryDependencies: ["@audio-ui/piano", "@audio-ui/use-midi-input"],
    type: "registry:example",
  },
  {
    categories: ["piano"],
    description: "Piano lit from an external source via activeNotes",
    files: [
      {
        path: "components/piano/piano-active-notes-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "piano-active-notes-demo",
    registryDependencies: ["@audio-ui/piano"],
    type: "registry:example",
  },
  {
    categories: ["piano-roll", "synth"],
    description:
      "A MIDI clip editor: a scrolling roll with a playable keyboard down its side, a loop brace and a ruler that labels bars, beats and sixteenths as you zoom, and a velocity lane you can drag taller. The transport plays, pauses and stops, loops or plays once through, clicks a metronome and sets the tempo and signature. Draw or select notes, mark a scale and fold onto it, undo and redo, and edit the selection from the Notes menu: split at the playhead, chop, join, legato, reverse, invert, stretch, fit to scale, crescendo and humanize. Drop a MIDI file on it to import one, or export the clip as a .mid file",
    files: [
      {
        path: "components/piano-roll/block-piano-roll.tsx",
        type: "registry:block",
      },
    ],
    name: "block-piano-roll",
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    registryDependencies: [
      "@audio-ui/piano-roll",
      "@audio-ui/timeline",
      "@audio-ui/transport",
      "@audio-ui/fader",
      "@audio-ui/scale-menu",
      "@audio-ui/note-find",
      "@audio-ui/note-edit-menu",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-synth-voices",
      "@audio-ui/use-piano-roll-playback",
      "@audio-ui/use-undo-history",
      "@audio-ui/web-audio",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:block",
  },
  {
    categories: ["piano-roll"],
    dependencies: ["@audio-ui/engine"],
    description: "A scale menu lighting the keys of the scale it picks",
    files: [
      {
        path: "components/piano-roll/scale-menu-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "scale-menu-demo",
    registryDependencies: [
      "@audio-ui/scale-menu",
      "@audio-ui/piano",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:example",
  },
  {
    categories: ["piano-roll"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "Find notes on a piano roll by pitch, scale, state, velocity, length or chance, and select them",
    files: [
      {
        path: "components/piano-roll/note-find-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "note-find-demo",
    registryDependencies: [
      "@audio-ui/note-find",
      "@audio-ui/piano-roll",
      "@audio-ui/timeline",
    ],
    type: "registry:example",
  },
  {
    categories: ["piano-roll"],
    dependencies: ["@audio-ui/core"],
    description:
      "A menu of note edits over a piano roll's selection, beside an item of its own",
    files: [
      {
        path: "components/piano-roll/note-edit-menu-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "note-edit-menu-demo",
    registryDependencies: [
      "@audio-ui/note-edit-menu",
      "@audio-ui/piano-roll",
      "@audio-ui/timeline",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:example",
  },
  {
    categories: ["piano-roll", "synth"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "A one-bar piano roll on loop with a metronome, played by a synth, which hears edits on its next pass",
    files: [
      {
        path: "components/piano-roll/piano-roll-playback-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "piano-roll-playback-demo",
    registryDependencies: [
      "@audio-ui/use-piano-roll-playback",
      "@audio-ui/use-synth-voices",
      "@audio-ui/use-master-bus",
      "@audio-ui/piano-roll",
      "@audio-ui/timeline",
      "@audio-ui/use-play-switch",
    ],
    type: "registry:example",
  },
  {
    categories: ["piano-roll"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "A piano roll that exports its clip as a .mid file and imports one onto its grid, with the file's tempo",
    files: [
      {
        path: "components/piano-roll/piano-roll-midi-file-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "piano-roll-midi-file-demo",
    registryDependencies: [
      "@audio-ui/piano-roll",
      "@audio-ui/timeline",
      "@shadcn/button",
    ],
    type: "registry:example",
  },
  {
    categories: ["meter"],
    description: "Meter size default example",
    files: [
      {
        path: "components/meter/meter-size-default-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "meter-size-default-demo",
    registryDependencies: ["@audio-ui/meter", "@audio-ui/use-simulated-levels"],
    type: "registry:example",
  },
  {
    categories: ["meter"],
    description:
      "A VU needle that follows the microphone when it is on, and a moving signal when it is not",
    files: [
      {
        path: "components/meter/needle-meter-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "needle-meter-demo",
    registryDependencies: [
      "@audio-ui/needle-meter",
      "@audio-ui/use-audio-levels",
      "@audio-ui/use-microphone",
      "@audio-ui/use-simulated-levels",
    ],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad with live x/y readout",
    files: [
      {
        path: "components/xypad/xypad-live-value-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-live-value-demo",
    registryDependencies: ["@audio-ui/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad with bipolar pan/mix style ranges",
    files: [
      {
        path: "components/xypad/xypad-bipolar-range-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-bipolar-range-demo",
    registryDependencies: ["@audio-ui/xypad"],
    type: "registry:example",
  },
  {
    categories: ["waveform"],
    description:
      "A waveform player that shows what the waveform does: seek and hover, a loop region with handles, markers and zoom that follows the playhead. It starts on a synthesized phrase and takes any audio file",
    files: [
      {
        path: "components/waveform/block-waveform-player.tsx",
        type: "registry:block",
      },
    ],
    name: "block-waveform-player",
    dependencies: ["@audio-ui/engine", "@audio-ui/icons"],
    registryDependencies: [
      "@audio-ui/scrubber",
      "@audio-ui/timeline",
      "@audio-ui/waveform",
      "@shadcn/button",
      "@shadcn/toggle",
      "@audio-ui/web-audio",
    ],
    type: "registry:block",
  },
  {
    categories: ["audio-editor"],
    description:
      "An audio editor for one sound: a demo loop, a file uploaded or dropped on it, or a take from the microphone after a count-in, drawn live as it records. The transport plays, loops and records, the sound menu picks or uploads, Undo and Redo follow, the meter and the main volume close the bar; the waveform seeks, zooms down to the samples and selects, its menu cuts, copies, pastes, deletes, crops and marks with their shortcuts, and the selection's corners fade it and its grip sets its level; Export renders the selection, or the whole sound, through the chain and saves it as WAV, MP3 or FLAC, and the readouts under the waveform give the time to the millisecond, the selection's length, the sound's loudness, peak, rate and channels; under it the track's device chain, an equalizer and a compressor to start, with the library beside it to add any effect. It plays on the audio clock through the arrangement engine",
    files: [
      {
        path: "components/audio-editor/block-audio-editor.tsx",
        type: "registry:block",
      },
    ],
    meta: {
      hint: "Drag over the waveform to select, right-click it to edit: Cmd/Ctrl + X, C, V, Delete, K to crop, M to mark, Cmd/Ctrl + Z to undo. Pick a sound or upload one from its menu, or drop an audio file. Double-click selects a hit, triple-click a sound between pauses. Space plays the selection, B plays it before the edits, the arrows move the cursor, = and - zoom. A pinch or Cmd/Ctrl + scroll zooms to the samples. Add an effect from the library to the chain.",
    },
    name: "block-audio-editor",
    dependencies: ["@audio-ui/engine", "@audio-ui/react"],
    registryDependencies: [
      "@audio-ui/arranged-clip",
      "@audio-ui/clip-spectrogram",
      "@audio-ui/use-gl-lane",
      "@audio-ui/waveform-lane",
      "@audio-ui/clip-waveform",
      "@audio-ui/device-browser",
      "@audio-ui/device-view",
      "@audio-ui/export-dialog",
      "@audio-ui/meter",
      "@audio-ui/sound-readouts",
      "@audio-ui/timeline",
      "@audio-ui/timeline-markers",
      "@audio-ui/transport",
      "@audio-ui/use-arrangement",
      "@audio-ui/use-time-selection",
      "@audio-ui/use-bake",
      "@audio-ui/sound-report",
      "@audio-ui/use-clip-edits",
      "@audio-ui/use-sound-report",
      "@audio-ui/use-silence-hover",
      "@audio-ui/use-status-line",
      "@audio-ui/clip-edits",
      "@audio-ui/arrangement-engine",
      "@audio-ui/use-audio-levels",
      "@audio-ui/arrangement",
      "@audio-ui/audio-export",
      "@audio-ui/clip-player",
      "@audio-ui/demo-sound",
      "@audio-ui/device-library",
      "@audio-ui/recording",
      "@audio-ui/web-audio",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/context-menu",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:block",
  },
  {
    categories: ["timeline"],
    description:
      "An arrangement timeline made for a whole screen: a bar ruler that seeks on the grid, a loop strip, a lane per track with clips to move between tracks, trim and fade on the grid, a cursor to put anywhere on a track, and a split at the cursor, a transport with play or pause, stop, loop, a metronome and a tempo and signature that keep the arrangement's musical positions, a playhead following the sound, and a navigator to zoom and scroll. It plays on the audio clock through the arrangement engine: audio clips loop a drum beat and a pad and draw their waveform, MIDI clips draw their notes, play a bass and chords through a synth and open on a piano roll in the clip panel; double-click a MIDI lane for a new clip. Drop an audio file on an audio track for a clip of it that plays, as long as the file; a clip dragged near an edge of the view scrolls it. Each track's meter reads its channel. In automation mode each track draws an envelope of its volume or pan over its clips, which its channel follows as it plays. Open it at full size and the tracks take the screen",
    files: [
      {
        path: "components/timeline/block-timeline.tsx",
        type: "registry:block",
      },
    ],
    meta: {
      hint: "Click a track or clip to place the cursor, S to split, Cmd/Ctrl + D to duplicate. Drag a clip's title bar to move it (Alt to copy), its edges to trim, its corners to fade. Drag the loop strip to set a loop, M to add a locator, A for the automation, Cmd/Ctrl + scroll to zoom. Drop an audio file on an audio track.",
    },
    name: "block-timeline",
    dependencies: ["@audio-ui/engine", "@audio-ui/icons"],
    registryDependencies: [
      "@audio-ui/timeline",
      "@audio-ui/transport",
      "@audio-ui/bpm-control",
      "@audio-ui/meter",
      "@audio-ui/track-level",
      "@audio-ui/use-audio-levels",
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
      "@audio-ui/arrangement-engine",
      "@audio-ui/clip-player",
      "@audio-ui/demo-song",
      "@audio-ui/drum-kit",
      "@audio-ui/reverb-device",
      "@audio-ui/mono-synth-device",
      "@audio-ui/organ-device",
      "@audio-ui/string-machine-device",
      "@audio-ui/channel-eq-device",
      "@audio-ui/compressor-device",
      "@audio-ui/limiter-device",
      "@audio-ui/vibe-device",
      "@audio-ui/web-audio",
      "@audio-ui/use-marquee-selection",
      "@audio-ui/use-time-selection",
      "@audio-ui/use-timeline-cursor",
      "@audio-ui/use-timeline-grid",
      "@audio-ui/use-timeline-zoom",
      "@audio-ui/clip-panel",
      "@audio-ui/midi-clip-panel",
      "@audio-ui/arranged-clip",
      "@audio-ui/timeline-markers",
      "@audio-ui/track-automation",
      "@audio-ui/use-track-reorder",
      "@audio-ui/arrangement-view",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/context-menu",
      "@shadcn/dropdown-menu",
      "@shadcn/kbd",
      "@shadcn/popover",
      "@shadcn/select",
      "@shadcn/toggle",
    ],
    type: "registry:block",
  },
  {
    categories: ["waveform"],
    description:
      "Waveform with a resizable loop region, markers and a hover time",
    files: [
      {
        path: "components/waveform/waveform-region-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "waveform-region-demo",
    registryDependencies: ["@audio-ui/waveform"],
    type: "registry:example",
  },
  {
    categories: ["plot"],
    description:
      "An equalizer: drag each band to set its frequency and gain, and the curve is the response of all three",
    files: [
      {
        path: "components/plot/plot-demo.tsx",
        type: "registry:example",
      },
    ],
    meta: {
      hint: "Click a band to set its type and width. Double-click empty space to add one, Delete to remove it.",
    },
    name: "plot-demo",
    dependencies: ["@audio-ui/engine"],
    registryDependencies: [
      "@audio-ui/plot",
      "@audio-ui/knob",
      "@audio-ui/use-noise-through-eq",
      "@audio-ui/use-spectrum",
      "@shadcn/popover",
      "@shadcn/select",
    ],
    type: "registry:example",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/engine", "@audio-ui/react"],
    description:
      "A compressor you can plug in: its state, a panel that draws it and a Web Audio engine that plays it, side by side. Play a pulsing signal and turn the knobs",
    files: [
      {
        path: "components/device/block-compressor.tsx",
        type: "registry:block",
      },
    ],
    name: "block-compressor",
    registryDependencies: [
      "@audio-ui/compressor-panel",
      "@audio-ui/compressor-device",
      "@audio-ui/compressor-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["eq", "plot", "knob"],
    dependencies: [],
    description:
      "An equalizer you can plug in: its state, a panel that draws it with a handle on each band and an engine that plays it, side by side. Play pink noise and the spectrum behind the curve is what comes out",
    files: [
      {
        path: "components/device/block-equalizer.tsx",
        type: "registry:block",
      },
    ],
    name: "block-equalizer",
    registryDependencies: [
      "@audio-ui/equalizer-panel",
      "@audio-ui/equalizer-device",
      "@audio-ui/equalizer-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-spectrum",
    ],
    type: "registry:block",
  },
  {
    categories: ["delay-reverb", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A delay you can plug in: its state, a panel that draws the echoes it makes with a handle for the time and the feedback, and an engine that plays it. Play a loop through it and drag",
    files: [
      {
        path: "components/device/block-delay.tsx",
        type: "registry:block",
      },
    ],
    name: "block-delay",
    registryDependencies: [
      "@audio-ui/delay-panel",
      "@audio-ui/delay-device",
      "@audio-ui/delay-engine",
      "@audio-ui/demo-sound",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["delay-reverb", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A reverb you can plug in: its state, a panel that draws the tail it makes with a handle for the decay time, and an engine that plays it. Play a loop through it and drag",
    files: [
      {
        path: "components/device/block-reverb.tsx",
        type: "registry:block",
      },
    ],
    name: "block-reverb",
    registryDependencies: [
      "@audio-ui/reverb-panel",
      "@audio-ui/reverb-device",
      "@audio-ui/reverb-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["eq", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A filter you can plug in: its state, a panel that draws the curve it plays with a handle for the cutoff and the resonance, and an engine that plays it. Play a loop through it and drag, the spectrum behind is what comes out",
    files: [
      {
        path: "components/device/block-filter.tsx",
        type: "registry:block",
      },
    ],
    name: "block-filter",
    registryDependencies: [
      "@audio-ui/filter-panel",
      "@audio-ui/filter-device",
      "@audio-ui/filter-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-spectrum",
    ],
    type: "registry:block",
  },
  {
    categories: ["distortion", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A distortion you can plug in: its state, a panel that draws its transfer curve and an engine that plays it. Play a loop through it and turn the drive",
    files: [
      {
        path: "components/device/block-distortion.tsx",
        type: "registry:block",
      },
    ],
    name: "block-distortion",
    registryDependencies: [
      "@audio-ui/distortion-panel",
      "@audio-ui/distortion-device",
      "@audio-ui/distortion-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["modulation", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A chorus you can plug in: its state, a panel that draws the sweep of its delay and an engine that plays it. Play a loop through it and turn the rate and the depth",
    files: [
      {
        path: "components/device/block-chorus.tsx",
        type: "registry:block",
      },
    ],
    name: "block-chorus",
    registryDependencies: [
      "@audio-ui/chorus-panel",
      "@audio-ui/chorus-device",
      "@audio-ui/chorus-engine",
      "@audio-ui/demo-sound",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["utility", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A utility you can plug in: its state, a panel and an engine that plays it. Play a loop through it and move the pan and the width",
    files: [
      {
        path: "components/device/block-utility.tsx",
        type: "registry:block",
      },
    ],
    name: "block-utility",
    registryDependencies: [
      "@audio-ui/utility-panel",
      "@audio-ui/utility-device",
      "@audio-ui/utility-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A limiter you can plug in: its state, a panel that draws its transfer curve with a handle on the ceiling and an engine that plays it. Play a loop through it, push the gain and pull the ceiling down",
    files: [
      {
        path: "components/device/block-limiter.tsx",
        type: "registry:block",
      },
    ],
    name: "block-limiter",
    registryDependencies: [
      "@audio-ui/limiter-panel",
      "@audio-ui/limiter-device",
      "@audio-ui/limiter-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A gate you can plug in: its state, a panel that draws its transfer curve with a handle on the threshold and an engine that plays it. Play a loop through it and raise the threshold: the quiet parts go",
    files: [
      {
        path: "components/device/block-gate.tsx",
        type: "registry:block",
      },
    ],
    name: "block-gate",
    registryDependencies: [
      "@audio-ui/gate-panel",
      "@audio-ui/gate-device",
      "@audio-ui/gate-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "An expander you can plug in: its state, a panel that draws its curve and an engine that plays it. Play a loop through it: downward, what falls under the threshold is turned down; upward, the peaks are lifted",
    files: [
      {
        path: "components/device/block-expander.tsx",
        type: "registry:block",
      },
    ],
    name: "block-expander",
    registryDependencies: [
      "@audio-ui/expander-panel",
      "@audio-ui/expander-device",
      "@audio-ui/expander-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A ducker you can plug in: its state, a panel that draws the gain for the key's level and an engine that plays it. A held chord, ducked by the kick of the loop",
    files: [
      {
        path: "components/device/block-ducker.tsx",
        type: "registry:block",
      },
    ],
    name: "block-ducker",
    registryDependencies: [
      "@audio-ui/ducker-panel",
      "@audio-ui/ducker-device",
      "@audio-ui/ducker-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A compander you can plug in: its state, a panel that draws its curve with a handle on each point and an engine that plays it. Play a loop through it and drag the points: under the straight line it turns the sound down, over it up",
    files: [
      {
        path: "components/device/block-compander.tsx",
        type: "registry:block",
      },
    ],
    name: "block-compander",
    registryDependencies: [
      "@audio-ui/compander-panel",
      "@audio-ui/compander-device",
      "@audio-ui/compander-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "An unlimiter you can plug in: its state, a panel that draws the lift for an attack's size and an engine that plays it. Play a loop through it: its flattened attacks are lifted back",
    files: [
      {
        path: "components/device/block-unlimiter.tsx",
        type: "registry:block",
      },
    ],
    name: "block-unlimiter",
    registryDependencies: [
      "@audio-ui/unlimiter-panel",
      "@audio-ui/unlimiter-device",
      "@audio-ui/unlimiter-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["distortion", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A saturator you can plug in: its state, a panel that draws its transfer curve and an engine that plays it. Play a loop through it, pick a curve and turn the drive",
    files: [
      {
        path: "components/device/block-saturator.tsx",
        type: "registry:block",
      },
    ],
    name: "block-saturator",
    registryDependencies: [
      "@audio-ui/saturator-panel",
      "@audio-ui/saturator-device",
      "@audio-ui/saturator-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["modulation", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A phaser and flanger you can plug in: its state, a panel that draws the sweep and an engine that plays it. Play a loop through it, switch the mode and turn the rate and the feedback",
    files: [
      {
        path: "components/device/block-phaser.tsx",
        type: "registry:block",
      },
    ],
    name: "block-phaser",
    registryDependencies: [
      "@audio-ui/phaser-panel",
      "@audio-ui/phaser-device",
      "@audio-ui/phaser-engine",
      "@audio-ui/demo-sound",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["modulation", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A photocell vibe you can plug in: its state, a panel that draws the lamp and an engine that plays it, each its own file. Play the loop and turn the speed and the intensity",
    files: [
      {
        path: "components/device/block-vibe.tsx",
        type: "registry:block",
      },
    ],
    name: "block-vibe",
    registryDependencies: [
      "@audio-ui/vibe-panel",
      "@audio-ui/vibe-device",
      "@audio-ui/vibe-engine",
      "@audio-ui/demo-sound",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["modulation", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "An auto pan you can plug in: its state, a panel that draws the movement and an engine that plays it. Play a loop through it, pick a waveform and switch to tremolo",
    files: [
      {
        path: "components/device/block-auto-pan.tsx",
        type: "registry:block",
      },
    ],
    name: "block-auto-pan",
    registryDependencies: [
      "@audio-ui/auto-pan-panel",
      "@audio-ui/auto-pan-device",
      "@audio-ui/auto-pan-engine",
      "@audio-ui/demo-sound",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["eq", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A channel EQ you can plug in: its state, a panel that draws the curve with a handle on the mid band and an engine that plays it. Play a loop through it and drag, the spectrum behind is what comes out",
    files: [
      {
        path: "components/device/block-channel-eq.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-eq",
    registryDependencies: [
      "@audio-ui/channel-eq-panel",
      "@audio-ui/channel-eq-device",
      "@audio-ui/channel-eq-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-spectrum",
    ],
    type: "registry:block",
  },
  {
    categories: ["distortion", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "An overdrive you can plug in: its state, a panel that draws the band that reaches the clip and an engine that plays it. Play a loop through it, drag the handle and turn the drive",
    files: [
      {
        path: "components/device/block-overdrive.tsx",
        type: "registry:block",
      },
    ],
    name: "block-overdrive",
    registryDependencies: [
      "@audio-ui/overdrive-panel",
      "@audio-ui/overdrive-device",
      "@audio-ui/overdrive-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-spectrum",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A de-esser you can plug in: its state, a panel that draws what it does at each frequency and an engine that plays it. Play a voice through it, lower the threshold and the s sits back",
    files: [
      {
        path: "components/device/block-deesser.tsx",
        type: "registry:block",
      },
    ],
    name: "block-deesser",
    registryDependencies: [
      "@audio-ui/deesser-panel",
      "@audio-ui/deesser-device",
      "@audio-ui/deesser-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-spectrum",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A multiband compressor you can plug in: its state, a panel that draws the three bands and an engine that plays it. Play a loop through it and hold one band down",
    files: [
      {
        path: "components/device/block-multiband.tsx",
        type: "registry:block",
      },
    ],
    name: "block-multiband",
    registryDependencies: [
      "@audio-ui/multiband-panel",
      "@audio-ui/multiband-device",
      "@audio-ui/multiband-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-spectrum",
    ],
    type: "registry:block",
  },
  {
    categories: ["dynamics", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A transient shaper you can plug in: its state, a panel with a handle for the attack and the sustain and an engine that plays it. Play a loop through it and drag the handle: up for more click, left for a shorter ring",
    files: [
      {
        path: "components/device/block-transient.tsx",
        type: "registry:block",
      },
    ],
    name: "block-transient",
    registryDependencies: [
      "@audio-ui/transient-panel",
      "@audio-ui/transient-device",
      "@audio-ui/transient-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["utility", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A mid/side device you can plug in: its state, a panel with a handle for the mid and the side and an engine that plays it. Play a wide loop through it and take the side down",
    files: [
      {
        path: "components/device/block-mid-side.tsx",
        type: "registry:block",
      },
    ],
    name: "block-mid-side",
    registryDependencies: [
      "@audio-ui/mid-side-panel",
      "@audio-ui/mid-side-device",
      "@audio-ui/mid-side-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["distortion", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A redux you can plug in: its state, a panel that draws the stairs the bits make and an engine that plays it. Play a loop through it and take the bits down",
    files: [
      {
        path: "components/device/block-redux.tsx",
        type: "registry:block",
      },
    ],
    name: "block-redux",
    registryDependencies: [
      "@audio-ui/redux-panel",
      "@audio-ui/redux-device",
      "@audio-ui/redux-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["distortion", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A lo-fi you can plug in: its state, a panel that draws the band it leaves and an engine that plays it. Play a loop through it and turn up the wow and the crackle",
    files: [
      {
        path: "components/device/block-lofi.tsx",
        type: "registry:block",
      },
    ],
    name: "block-lofi",
    registryDependencies: [
      "@audio-ui/lofi-panel",
      "@audio-ui/lofi-device",
      "@audio-ui/lofi-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["eq", "plot", "fader", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A graphic EQ you can plug in: its state, a panel that draws the curve over a fader per band and an engine that plays it. Play a loop through it and pull the faders, the spectrum behind is what comes out",
    files: [
      {
        path: "components/device/block-graphic-eq.tsx",
        type: "registry:block",
      },
    ],
    name: "block-graphic-eq",
    registryDependencies: [
      "@audio-ui/graphic-eq-panel",
      "@audio-ui/graphic-eq-device",
      "@audio-ui/graphic-eq-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["eq", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A tilt EQ you can plug in: its state, a panel that draws the curve it tilts and an engine that plays it. Play a loop through it and turn the tilt: brighter one way, darker the other",
    files: [
      {
        path: "components/device/block-tilt-eq.tsx",
        type: "registry:block",
      },
    ],
    name: "block-tilt-eq",
    registryDependencies: [
      "@audio-ui/tilt-eq-panel",
      "@audio-ui/tilt-eq-device",
      "@audio-ui/tilt-eq-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["modulation", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A wah you can plug in: its state, a panel that draws the band and its travel and an engine that plays it. Play a loop through it: the louder the hit, the higher the band",
    files: [
      {
        path: "components/device/block-wah.tsx",
        type: "registry:block",
      },
    ],
    name: "block-wah",
    registryDependencies: [
      "@audio-ui/wah-panel",
      "@audio-ui/wah-device",
      "@audio-ui/wah-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["modulation", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A frequency shifter you can plug in: its state, a panel that draws what it does to a note and an engine that plays it. Play a loop through it and turn the shift: its harmonics stop lining up",
    files: [
      {
        path: "components/device/block-frequency-shifter.tsx",
        type: "registry:block",
      },
    ],
    name: "block-frequency-shifter",
    registryDependencies: [
      "@audio-ui/frequency-shifter-panel",
      "@audio-ui/frequency-shifter-device",
      "@audio-ui/frequency-shifter-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["eq", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "An exciter you can plug in: its state, a panel that draws the band it excites and an engine that plays it. Play a loop through it and raise the amount: it comes forward",
    files: [
      {
        path: "components/device/block-exciter.tsx",
        type: "registry:block",
      },
    ],
    name: "block-exciter",
    registryDependencies: [
      "@audio-ui/exciter-panel",
      "@audio-ui/exciter-device",
      "@audio-ui/exciter-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["eq", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A bass enhancer you can plug in: its state, a panel that draws the sub it takes and where its harmonics go, and an engine that plays it. Play a loop through it on small speakers and raise the amount",
    files: [
      {
        path: "components/device/block-bass-enhancer.tsx",
        type: "registry:block",
      },
    ],
    name: "block-bass-enhancer",
    registryDependencies: [
      "@audio-ui/bass-enhancer-panel",
      "@audio-ui/bass-enhancer-device",
      "@audio-ui/bass-enhancer-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["modulation", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A rotary speaker you can plug in: its state, a panel that draws its two bands and an engine that plays it. Play a loop through it and switch to Fast: the rotors wind up",
    files: [
      {
        path: "components/device/block-rotary.tsx",
        type: "registry:block",
      },
    ],
    name: "block-rotary",
    registryDependencies: [
      "@audio-ui/rotary-panel",
      "@audio-ui/rotary-device",
      "@audio-ui/rotary-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["modulation", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A stutter you can plug in: its state, a panel that draws one interval and an engine that plays it. Play a loop through it and switch it on: it catches a slice and repeats it",
    files: [
      {
        path: "components/device/block-stutter.tsx",
        type: "registry:block",
      },
    ],
    name: "block-stutter",
    registryDependencies: [
      "@audio-ui/stutter-panel",
      "@audio-ui/stutter-device",
      "@audio-ui/stutter-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["utility", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "A binaural panner you can plug in: its state, a panel with the head seen from above and an engine that plays it. Put headphones on, play a loop and drag the sound around the head",
    files: [
      {
        path: "components/device/block-binaural-panner.tsx",
        type: "registry:block",
      },
    ],
    name: "block-binaural-panner",
    registryDependencies: [
      "@audio-ui/binaural-panner-panel",
      "@audio-ui/binaural-panner-device",
      "@audio-ui/binaural-panner-engine",
      "@audio-ui/use-device-loop",
      "@audio-ui/use-master-bus",
    ],
    type: "registry:block",
  },
  {
    categories: ["mixer", "fader", "meter", "knob"],
    description:
      "Mixing console over an arrangement: a channel for each track with pan, sends, fader, meter, peak, solo and mute, a return track after them and the main track in sight at the right, every meter reading its real signal. It is the view a workstation shows under its tracks",
    files: [
      {
        path: "components/mixer/block-mixer.tsx",
        type: "registry:block",
      },
    ],
    name: "block-mixer",
    dependencies: [],
    registryDependencies: [
      "@audio-ui/mixer-view",
      "@audio-ui/arrangement",
      "@audio-ui/arrangement-engine",
      "@audio-ui/use-arrangement",
      "@audio-ui/track-automation",
      "@audio-ui/use-play-switch",
      "@audio-ui/clip-player",
      "@audio-ui/demo-sound",
      "@audio-ui/device-library",
      "@audio-ui/web-audio",
    ],
    type: "registry:block",
  },
  {
    categories: ["device-browser"],
    description:
      "A library of devices by shelf, with a search: pick one with Enter, a double-click or the Add button, or drag it onto a chain, and see what comes back",
    files: [
      {
        path: "components/device-browser/block-device-browser.tsx",
        type: "registry:block",
      },
    ],
    meta: {
      hint: "Type to search every shelf, Enter to add the first device found, ArrowDown to go into the list. Double-click a device, or drag it onto the drop area.",
    },
    name: "block-device-browser",
    registryDependencies: [
      "@audio-ui/device-browser",
      "@audio-ui/device-chain",
      "@audio-ui/device-library",
    ],
    type: "registry:block",
  },
  {
    categories: ["device-chain", "knob"],
    dependencies: [],
    description:
      "A track's devices in a row with the library beside them: drag a device to where it goes, move, fold, switch off or remove one, and play a loop through each device's own panel and engine. It is the view a workstation shows under its tracks, over an arrangement of one track",
    files: [
      {
        path: "components/device-chain/block-device-chain.tsx",
        type: "registry:block",
      },
    ],
    name: "block-device-chain",
    registryDependencies: [
      "@audio-ui/device-view",
      "@audio-ui/device-browser",
      "@audio-ui/device-library",
      "@audio-ui/arrangement",
      "@audio-ui/arrangement-engine",
      "@audio-ui/use-arrangement",
      "@audio-ui/clip-player",
      "@audio-ui/demo-sound",
      "@audio-ui/use-demo-source",
      "@audio-ui/use-play-switch",
      "@audio-ui/web-audio",
    ],
    type: "registry:block",
  },
  {
    categories: ["pad", "knob"],
    description:
      "Drum rack: sixteen pads, each its own sound, shaped with tune, decay and level knobs",
    files: [
      {
        path: "components/pad/block-drum-rack.tsx",
        type: "registry:block",
      },
    ],
    name: "block-drum-rack",
    registryDependencies: [
      "@audio-ui/pad",
      "@audio-ui/knob",
      "@audio-ui/use-master-bus",
      "@audio-ui/web-audio",
      "@audio-ui/drum-synthesis",
    ],
    type: "registry:block",
  },
  {
    categories: ["pad"],
    description:
      "Four drum pads that play harder near the top; the closed hat cuts the open one short",
    files: [
      {
        path: "components/pad/pad-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "pad-demo",
    registryDependencies: [
      "@audio-ui/pad",
      "@audio-ui/use-master-bus",
      "@audio-ui/web-audio",
      "@audio-ui/drum-synthesis",
    ],
    type: "registry:example",
  },
  {
    categories: ["tuner"],
    description:
      "A chromatic tuner: start it, play a note and read the nearest note, a needle on a scale of cents and the frequency, in the primary color within 5 cents, with a field for the pitch of A4",
    files: [
      {
        path: "components/tuner/tuner-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "tuner-demo",
    registryDependencies: ["@audio-ui/tuner"],
    type: "registry:example",
  },
  {
    categories: ["spectrum"],
    description:
      "Press play, or play a MIDI keyboard, and watch the spectrum: each sawtooth note lights its pitch and every harmonic above it, and the peaks hold a moment",
    files: [
      {
        path: "components/spectrum/spectrum-analyzer-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "spectrum-analyzer-demo",
    registryDependencies: [
      "@audio-ui/spectrum-analyzer",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-play-switch",
      "@audio-ui/use-spectrum",
      "@audio-ui/use-synth-voices",
      "@audio-ui/web-audio",
      "@audio-ui/envelope-ramp",
    ],
    type: "registry:example",
  },
  {
    dependencies: ["@audio-ui/icons"],
    categories: ["sequencer"],
    description:
      "A drum machine: draw a pattern and hear it. Press a step or drag across several; the playing column lights up",
    files: [
      {
        path: "components/sequencer/sequencer-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sequencer-demo",
    registryDependencies: ["@audio-ui/sequencer"],
    type: "registry:example",
  },
  {
    categories: ["scrubber"],
    description:
      "A bar to seek on, with play or pause, the position and the length: a clock stands in for a player, and the bar and the time follow it",
    files: [
      {
        path: "components/scrubber/scrubber-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "scrubber-demo",
    registryDependencies: ["@audio-ui/scrubber"],
    type: "registry:example",
  },
  {
    categories: ["transport"],
    description:
      "The transport of a DAW as joined clusters: play or pause, stop and the position in bars, beats and sixteenths; loop and metronome toggles; the tempo and the time signature. A clock stands in for the engine",
    files: [
      {
        path: "components/transport/transport-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "transport-demo",
    dependencies: ["@audio-ui/react", "@audio-ui/engine"],
    registryDependencies: ["@audio-ui/transport"],
    type: "registry:example",
  },
  {
    categories: ["transport"],
    description:
      "The export dialog over two seconds of a chord: pick a format and a level, and Export saves the file and says how loud it came out, in LUFS and dBTP",
    files: [
      {
        path: "components/transport/export-dialog-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "export-dialog-demo",
    registryDependencies: [
      "@audio-ui/audio-export",
      "@audio-ui/export-dialog",
      "@shadcn/button",
    ],
    type: "registry:example",
  },
  {
    categories: ["audio-editor"],
    description:
      "A sound's facts as parts: its level in the measure you pick, its sample rate and its channels, each a menu that says what to convert it to",
    files: [
      {
        path: "components/audio-editor/sound-readouts-readouts-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sound-readouts-demo",
    registryDependencies: ["@audio-ui/sound-readouts"],
    type: "registry:example",
  },
];
