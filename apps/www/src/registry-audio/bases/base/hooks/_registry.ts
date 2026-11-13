import type { RegistryItem } from "shadcn/schema";
import { hookItem } from "../../items";

/** The hooks: React integration over the libs and the Web Audio API, each in `hooks/`. */
export const hooks: RegistryItem[] = [
  {
    description:
      "Gone: the page's one AudioContext is the webAudio of the web-audio lib, imported where it is used. Installs that lib.",
    files: [],
    name: "use-web-audio",
    registryDependencies: ["@audio-ui/web-audio"],
    type: "registry:hook",
  },
  {
    description:
      "Gone: a playhead with no sound is not a clock. Installs use-transport-clock, the clock on the audio clock.",
    files: [],
    name: "use-playback-clock",
    registryDependencies: ["@audio-ui/use-transport-clock"],
    type: "registry:hook",
  },
  {
    description:
      "Gone: a playhead with no sound is not a clock; use-transport-clock moves one on the audio clock, and the arrangement engine's position is where its sound plays. Installs use-transport-clock.",
    files: [],
    name: "use-simulated-clock",
    registryDependencies: ["@audio-ui/use-transport-clock"],
    type: "registry:hook",
  },
  hookItem("use-marquee-selection", {
    categories: ["audio", "timeline"],
    description:
      "A selection rectangle for the clips of a timeline: drag across bare lane (with Shift, or in a multi-select mode) and the clips it touches join the selection",
  }),
  {
    categories: ["audio", "timeline"],
    dependencies: ["@audio-ui/react", "@audio-ui/core", "@audio-ui/engine"],
    description:
      "The state of an arrangement of clips on tracks, with its operations: selection, group moves and copies, split, duplicate, delete, adding and removing tracks, per-track mix and height, and undo and redo over tracks and clips",
    files: [
      {
        path: "hooks/use-arrangement.ts",
        type: "registry:hook",
      },
      {
        path: "lib/arrangement-state.ts",
        type: "registry:lib",
      },
    ],
    name: "use-arrangement",
    registryDependencies: ["@audio-ui/arrangement", "@audio-ui/undo-history"],
    type: "registry:hook",
  },
  {
    description:
      "Gone: the arrangement engine plays MIDI clips through each track's instrument and chain, on the audio clock. Installs arrangement-engine.",
    files: [],
    name: "use-midi-playback",
    registryDependencies: ["@audio-ui/arrangement-engine"],
    type: "registry:hook",
  },
  {
    categories: ["timeline", "mixer"],
    description:
      "Reorders tracks: drag a track's grip to move it, with the view scrolling at its edges and a copy of its header under the pointer, or press Up and Down on the grip. With the grip, the copy and the line where the track would land.",
    files: [
      {
        path: "hooks/use-track-reorder.ts",
        type: "registry:hook",
      },
      {
        path: "audio/elements/track-grip.tsx",
        type: "registry:ui",
      },
    ],
    name: "use-track-reorder",
    registryDependencies: ["@audio-ui/sortable-drag"],
    type: "registry:hook",
  },
  hookItem("use-timeline-zoom", {
    categories: ["timeline"],
    description:
      "The zoom of an arrangement's timeline: it fits the view beside the track headers until it is zoomed, zooms around a time that stays put on screen, fits a stretch of time, steps back through the zooms it left, and keeps its bars when the tempo changes.",
  }),
  {
    categories: ["timeline"],
    dependencies: ["@audio-ui/react"],
    description:
      "A stretch of time on some tracks of an arrangement, drawn by dragging across bare lanes, with its overlay and what the keyboard does with it: copy, cut, paste, duplicate, consolidate, loop, fade, delete and open time, each one step of undo.",
    files: [
      {
        path: "hooks/use-time-selection.ts",
        type: "registry:hook",
      },
      {
        path: "audio/elements/time-selection.tsx",
        type: "registry:ui",
      },
    ],
    name: "use-time-selection",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
    ],
    type: "registry:hook",
  },
  hookItem("use-timeline-cursor", {
    categories: ["timeline"],
    dependencies: ["@audio-ui/core", "@audio-ui/react"],
    description:
      "What the keyboard does with an arrangement's cursor: the arrows on the grid, Home and End, Up and Down to pick a track, Alt and the arrows to jump between locators and clip edges, M to add a locator.",
    registryDependencies: ["@audio-ui/arrangement"],
  }),
  hookItem("use-timeline-grid", {
    categories: ["timeline"],
    dependencies: ["@audio-ui/engine"],
    description:
      "The grid of an arrangement's timeline: adaptive to the zoom or a fixed division, straight or triplet, snapping or not, its name for a menu button, and the changes Cmd/Ctrl + 1 to 5 make.",
  }),
  hookItem("use-transport-clock", {
    categories: ["audio", "sequencer", "piano"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A look-ahead transport clock on the audio clock: it calls back with the audio time of each step so notes are scheduled sample-accurately, with a loop region, seek and tempo changes.",
    registryDependencies: ["@audio-ui/web-audio"],
  }),
  hookItem("use-piano-roll-playback", {
    categories: ["audio", "piano", "sequencer"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine", "@audio-ui/react"],
    description:
      "Plays a piano roll's notes, which you own: play, pause and stop, a loop or once through, a metronome, seeking, and the notes the roll auditions, with a playhead for the timeline and a clock for the transport.",
    registryDependencies: [
      "@audio-ui/drum-synthesis",
      "@audio-ui/use-transport-clock",
      "@audio-ui/use-synth-voices",
      "@audio-ui/envelope-ramp",
      "@audio-ui/web-audio",
    ],
  }),
  hookItem("use-clip-edits", {
    categories: ["audio", "timeline"],
    dependencies: ["@audio-ui/react"],
    description:
      "The edits of one sound on a track, each one step of undo: Cut, Copy, Paste, Delete, Crop, Mark, Louder and Quieter on a time selection, Trim silence and Shrink pauses from the pauses it is given, and the keyboard of all of them with Undo and Redo",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/clip-edits",
      "@audio-ui/use-arrangement",
    ],
  }),
  hookItem("use-loudest", {
    categories: ["audio", "timeline"],
    dependencies: ["@audio-ui/gl"],
    description:
      "The loudest sample of a recording, from the leaves of a streamed one or read in chunks a frame apart so a long one does not hold the page: what a waveform drawn on the GPU is scaled by, null until it is read",
  }),
  hookItem("use-bake", {
    categories: ["audio", "timeline"],
    dependencies: ["@audio-ui/engine"],
    description:
      "Changes the samples of a sound as edited: renders what a track's clips play, hands the channels to an operation and puts the result back as one step of undo, with Reverse, Repeat, Add silence, Normalize, Pan, Filter, Stretch, Pitch, Speed, Dither and Repair over it",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/arrangement-engine",
      "@audio-ui/clip-player",
    ],
  }),
  hookItem("use-sound-report", {
    categories: ["audio", "timeline"],
    dependencies: ["@audio-ui/engine"],
    description:
      "Reads the sound of a track as edited, to tell what it is: its loudness, key and tempo, and whether it meets ACX's audiobook requirements, held as a report until it is cleared",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/clip-player",
      "@audio-ui/use-bake",
    ],
  }),
  hookItem("use-silence-hover", {
    categories: ["audio", "timeline"],
    description:
      "The pause under the pointer on a lane, to draw as a zone while it is there: give the lane its pointer handlers and the zoom it is drawn at",
  }),
  hookItem("use-status-line", {
    categories: ["audio"],
    description:
      "A line of status an editor says things on, what it is doing and what an action had nothing to do on, which clears itself after a few seconds",
  }),
  hookItem("use-undo-history", {
    categories: ["timeline", "piano", "envelope"],
    description:
      "Undo and redo over a value you own: an edit made in one go, or a gesture that undoes as one.",
    registryDependencies: ["@audio-ui/undo-history"],
  }),
  hookItem("use-master-bus", {
    categories: ["audio", "synth", "sequencer"],
    description:
      "A master output bus with a safety limiter: every source connects into one gain node that a single fader governs.",
    registryDependencies: ["@audio-ui/web-audio"],
  }),
  hookItem("use-device-engines", {
    categories: ["hooks", "audio", "device"],
    dependencies: ["@audio-ui/engine"],
    description:
      "The engines of a device on a page: as many as asked, made on a destination's context from the state of the moment, each following the state and the host's tempo, disposed when the destination changes and on unmount, never updated once disposed. One for an effect, one per voice for an instrument.",
    registryDependencies: [],
  }),
  hookItem("use-polyphony", {
    categories: ["audio", "synth"],
    dependencies: ["@audio-ui/engine"],
    description:
      "An instrument whose engine plays one voice, played as chords: as many engines as notes sound at once, made into a destination, each following the state, every note on a voice of its own.",
    registryDependencies: [
      "@audio-ui/polyphony",
      "@audio-ui/use-device-engines",
    ],
  }),
  hookItem("use-synth-voices", {
    categories: ["audio", "synth", "piano", "envelope"],
    dependencies: ["@audio-ui/engine"],
    description:
      "Polyphonic synth voices on the Web Audio API: start and release notes with an envelope, a velocity and a pitch bend.",
    registryDependencies: ["@audio-ui/envelope-ramp"],
  }),
  hookItem("use-midi-input", {
    categories: ["audio", "piano", "synth"],
    dependencies: ["@audio-ui/engine"],
    description:
      "The notes of the page's MIDI input, with velocity and pitch bend: every component that calls it hears the same devices.",
  }),
  {
    categories: ["audio", "piano", "synth"],
    description:
      "The computer's keyboard as a keyboard of notes, as in a DAW: the middle row from A plays the white keys and the row above the black ones, by where the keys sit; Z and X move an octave, C and V the velocity.",
    files: [
      {
        path: "hooks/use-computer-keyboard.ts",
        type: "registry:hook",
      },
      {
        path: "lib/computer-keyboard.ts",
        type: "registry:lib",
      },
    ],
    name: "use-computer-keyboard",
    registryDependencies: [],
    type: "registry:hook",
  },
  hookItem("use-audio-signal", {
    categories: ["audio", "waveform"],
    dependencies: ["@audio-ui/engine"],
    description:
      "An AnalyserNode as live signals for a waveform: the loudest sample of the moment, frequency bands and the raw samples, read every frame without re-rendering",
  }),
  hookItem("use-demo-source", {
    categories: ["hooks", "audio"],
    description:
      "The sound a device plays: the one chosen in its session, such as from a preview's bar, else the one that shows best what the device does. It tells the session its default, so a bar can offer the choice only where there is one. Outside a session it is always the default.",
    registryDependencies: [
      "@audio-ui/demo-sound",
      "@audio-ui/use-audio-session",
    ],
  }),
  hookItem("use-audio-session", {
    categories: ["hooks", "audio"],
    description:
      "A session of its own for a demo and its controls: a play switch and a microphone switch that nothing outside it follows. Holds no audio, so two previews on a page never play together. Outside a session the switches stay off.",
    files: ["hooks/use-audio-session.tsx"],
  }),
  hookItem("use-play-switch", {
    categories: ["hooks", "audio"],
    description:
      "The play switch of the nearest session: a button in its bar flips it, every component inside the session that reads it follows. Holds no audio, so a demo can leave its play button to its host.",
    registryDependencies: ["@audio-ui/use-audio-session"],
  }),
  hookItem("use-microphone", {
    categories: ["hooks", "audio", "tuner"],
    description:
      "The microphone as an AnalyserNode on the shared AudioContext: raw signal, never connected to the speakers, released on stop and on unmount. The session's switch, usePageMicrophone, lets a button turn it on for a demo",
    registryDependencies: [
      "@audio-ui/web-audio",
      "@audio-ui/use-audio-session",
    ],
  }),
  hookItem("use-pitch", {
    categories: ["hooks", "audio", "tuner"],
    dependencies: ["@audio-ui/react", "@audio-ui/engine"],
    description:
      "The pitch of a signal as a live source: the note nearest the sound and its offset in cents, steadied by a median and held a moment after the sound stops, with no React render per reading",
  }),
  hookItem("use-audio-levels", {
    categories: ["hooks", "audio", "meter"],
    dependencies: ["@audio-ui/react", "@audio-ui/engine"],
    description:
      "The live levels of a signal from its AnalyserNodes, in the shape a Meter paints from: RMS in dB per channel with a peak that holds and falls, refreshed every frame without re-rendering",
  }),
  hookItem("use-loudness", {
    categories: ["hooks", "audio", "meter"],
    dependencies: ["@audio-ui/react", "@audio-ui/engine"],
    description:
      "How loud a signal is while it plays, in LUFS, as streaming services and broadcasters measure it (ITU-R BS.1770): its momentary, short-term and integrated loudness, measured on the audio thread, as a live source refreshed every 100 ms without re-rendering",
    registryDependencies: [],
  }),
  hookItem("use-simulated-levels", {
    categories: ["hooks", "audio", "meter"],
    description:
      "Levels that move on their own, with a peak that holds and falls, in the shape a Meter paints from: a demo meter that is never at rest",
  }),
  hookItem("use-spectrum", {
    categories: ["hooks", "audio", "plot"],
    dependencies: ["@audio-ui/react", "@audio-ui/engine"],
    description:
      "The spectrum of an AnalyserNode as a live source for Plot.Trace: dB per point on a logarithmic frequency axis, refreshed every frame without re-rendering, and its held peaks as a second source",
  }),
  hookItem("use-noise-through-eq", {
    categories: ["hooks", "audio", "plot"],
    dependencies: ["@audio-ui/engine"],
    description:
      "Pink noise played through an equalizer that follows your bands, with the analyser after it: what a plot draws is what is heard",
    registryDependencies: ["@audio-ui/use-play-switch", "@audio-ui/web-audio"],
  }),
  hookItem("use-device-loop", {
    categories: ["hooks", "audio", "device"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A short loop of drums and plucked notes played through an effect's engine and out to a destination, for a block to show what a device does: it plays while the session's play switch is on, the engine is made for it and follows the state (use-device-engines), and analysers of what goes in and comes out are there for a meter or a spectrum.",
    registryDependencies: [
      "@audio-ui/demo-sound",
      "@audio-ui/use-demo-source",
      "@audio-ui/use-device-engines",
      "@audio-ui/use-play-switch",
      "@audio-ui/web-audio",
    ],
  }),
  {
    description:
      "Gone: a device's own block plays its loop through its engine with use-device-loop, and the compressor's panel draws the level going in. Installs use-device-loop.",
    files: [],
    name: "use-pulses-through-compressor",
    registryDependencies: ["@audio-ui/use-device-loop"],
    type: "registry:hook",
  },
];
