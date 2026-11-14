import type { RegistryItem } from "shadcn/schema";

/** How an envelope refuses a point: the styles' own keyframes, which an install has no other way to get. */
const ENVELOPE_SHAKE = {
  "@keyframes envelope-shake": {
    "0%": {
      "animation-timing-function": "cubic-bezier(0.22, 1, 0.36, 1)",
      translate: "0 0",
    },
    "28.57%": {
      "animation-timing-function": "cubic-bezier(0.22, 1, 0.36, 1)",
      translate: "6px 0",
    },
    "57.14%": {
      "animation-timing-function": "cubic-bezier(0.22, 1, 0.36, 1)",
      translate: "-6px 0",
    },
    "78.57%": {
      "animation-timing-function": "cubic-bezier(0.22, 1, 0.36, 1)",
      translate: "4px 0",
    },
    "100%": { translate: "0 0" },
  },
};

export const audio: RegistryItem[] = [
  {
    dependencies: ["@audio-ui/react"],
    description:
      "An editor for a breakpoint ramp, such as an ADSR shape or an automation curve.",
    files: [
      {
        path: "audio/elements/envelope.tsx",
        type: "registry:ui",
      },
    ],
    css: ENVELOPE_SHAKE,
    name: "envelope",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "A track's automation over its lane in a timeline: an envelope along the whole arrangement, under the same zoom and scroll as the clips, whose line and points alone take the pointer.",
    files: [
      {
        path: "audio/elements/automation-envelope.tsx",
        type: "registry:ui",
      },
    ],
    css: ENVELOPE_SHAKE,
    name: "automation-envelope",
    type: "registry:ui",
  },
  {
    description:
      "A clip's recording drawn on a canvas, a column per pixel of the screen, as its clip plays it: looped, reversed, warped. It draws only what the view shows, and a zoom in the frame it happens.",
    files: [
      {
        path: "audio/elements/clip-waveform.tsx",
        type: "registry:ui",
      },
    ],
    name: "clip-waveform",
    registryDependencies: ["@audio-ui/arrangement"],
    type: "registry:ui",
  },
  {
    categories: ["audio-editor"],
    dependencies: ["@audio-ui/gl"],
    description:
      "The waveforms of a lane's clips on one canvas and one WebGL context, drawn on the GPU by gl-waveform through @audio-ui/gl: the exact lowest and highest sample of every pixel column with the RMS inside, a line through the samples zoomed in, however long the recording. Plain, or as the three bands of the sound one over the other, the lows warm and the highs cool. Nothing without WebGL 2",
    files: [
      {
        path: "audio/elements/waveform-lane.tsx",
        type: "registry:ui",
      },
    ],
    name: "waveform-lane",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/engine", "@audio-ui/gl"],
    description:
      "The spectrograms of a lane's clips on one canvas and one WebGL context, computed on the GPU at every zoom by gl-spectrogram through @audio-ui/gl, on the frequency axis of your choice (octaves, mel, ERB or hertz), with the frequency and level under the pointer and an axis of frequency labels for the lane. It draws only what the view shows, in the text colour over the ground under it, and nothing without WebGL 2.",
    files: [
      {
        path: "audio/elements/clip-spectrogram.tsx",
        type: "registry:ui",
      },
    ],
    name: "clip-spectrogram",
    type: "registry:ui",
  },
  {
    categories: ["audio-editor"],
    dependencies: ["@audio-ui/gl", "@audio-ui/react"],
    description:
      "A lane's clips drawn on the GPU in the view you pick: the waveform, the waveform by band, or the spectrogram on octaves, mel, ERB or hertz with its frequency axis and the reading under the pointer. With the views labelled for a menu",
    files: [
      {
        path: "audio/elements/sound-lane.tsx",
        type: "registry:ui",
      },
    ],
    name: "sound-lane",
    registryDependencies: [
      "@audio-ui/clip-spectrogram",
      "@audio-ui/waveform-lane",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/engine", "@audio-ui/gl", "@audio-ui/react"],
    description:
      "A clip of an arrangement on its track's lane: move it, trim and fade it, pick a fade's curve, rename it in place and act on it from its menu. A MIDI clip draws its notes across its body; an audio clip given its recording draws its waveform on the GPU, a row a channel on a tall track, on the page's one WebGL context.",
    files: [
      {
        path: "audio/elements/arranged-clip.tsx",
        type: "registry:ui",
      },
      {
        path: "hooks/use-arranged-clips.ts",
        type: "registry:hook",
      },
    ],
    name: "arranged-clip",
    registryDependencies: [
      "@audio-ui/clip-waveform",
      "@audio-ui/waveform-lane",
      "@audio-ui/timeline",
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
      "@shadcn/context-menu",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/engine"],
    description:
      "Locators and time-signature changes on a timeline's lane: press one to jump there, drag it or use the arrows to move it on the grid, rename or retype it in place, delete either. With the bars of a ruler through those changes, and a hook for the commands behind them.",
    files: [
      {
        path: "audio/elements/timeline-markers.tsx",
        type: "registry:ui",
      },
      {
        path: "hooks/use-timeline-markers.ts",
        type: "registry:hook",
      },
    ],
    name: "timeline-markers",
    registryDependencies: [
      "@audio-ui/timeline",
      "@audio-ui/use-arrangement",
      "@shadcn/context-menu",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "A track's automation: a chooser of the parameter its lane shows, Volume or Pan, for its header, and that parameter's envelope over its lane, standing faint at the mix's value until it is drawn, with a hook for automation mode and the gains and pans moved by hand, which play their mix until enabled again.",
    files: [
      {
        path: "audio/elements/track-automation.tsx",
        type: "registry:ui",
      },
      {
        path: "hooks/use-track-automation.ts",
        type: "registry:hook",
      },
    ],
    name: "track-automation",
    registryDependencies: [
      "@audio-ui/automation-envelope",
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
      "@shadcn/button",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "A rotary control for continuous parameters, with pointer, wheel and keyboard input.",
    files: [
      {
        path: "audio/elements/knob.tsx",
        type: "registry:ui",
      },
    ],
    name: "knob",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description: "A linear slider for gain and other continuous parameters.",
    files: [
      {
        path: "audio/elements/fader.tsx",
        type: "registry:ui",
      },
    ],
    name: "fader",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "A two-dimensional control for two parameters at once, with pointer, wheel and keyboard input.",
    files: [
      {
        path: "audio/elements/xypad.tsx",
        type: "registry:ui",
      },
    ],
    name: "xypad",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "A grid of drum pads struck by pointer, touch or keyboard, with velocity and choke groups.",
    files: [
      {
        path: "audio/elements/pad.tsx",
        type: "registry:ui",
      },
    ],
    name: "pad",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "A piano keyboard for a MIDI pitch range, played with the pointer, touch or the keyboard.",
    files: [
      {
        path: "audio/elements/piano.tsx",
        type: "registry:ui",
      },
    ],
    name: "piano",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "A note editor on a grid: draw, move, resize and select notes, with a playable keyboard and a velocity lane.",
    files: [
      {
        path: "audio/elements/piano-roll.tsx",
        type: "registry:ui",
      },
    ],
    name: "piano-roll",
    registryDependencies: ["@audio-ui/timeline"],
    type: "registry:ui",
  },
  {
    categories: ["piano"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "A menu that picks a root and a scale and turns the scale on or off, in parts you place, beside items of your own; one part offers the keys the notes are likeliest in (by @audio/mir-key).",
    files: [
      {
        path: "audio/elements/scale-menu.tsx",
        type: "registry:ui",
      },
    ],
    name: "scale-menu",
    registryDependencies: ["@shadcn/button", "@shadcn/dropdown-menu"],
    type: "registry:ui",
  },
  {
    categories: ["audio-editor", "waveform"],
    dependencies: ["@audio-ui/engine"],
    description:
      "The Process menu's items over a sound's samples, in groups you place in a menu of your own: Structure (Reverse, Repeat, Add silence), Level and tone (Normalize, Pan, Dither, Filter), Time and pitch (Stretch, Pitch, Speed, each by the method picked) and Repair, each an operation handed to onProcess.",
    files: [
      {
        path: "audio/elements/process-menu.tsx",
        type: "registry:ui",
      },
    ],
    name: "process-menu",
    registryDependencies: [
      "@audio-ui/sound-operations",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:ui",
  },
  {
    categories: ["piano"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "Finds notes by what they are: a pitch, ranges of velocity, length and chance, in or out of the scale, active or not, every few, or the rest. A form, or the form in a popover.",
    files: [
      {
        path: "audio/elements/note-find.tsx",
        type: "registry:ui",
      },
    ],
    name: "note-find",
    registryDependencies: [
      "@shadcn/button",
      "@shadcn/input",
      "@shadcn/popover",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["audio-editor"],
    description:
      "The row of a sound's facts under its waveform, as parts: SoundLevel shows its peak, RMS or loudness with the others one click away, SoundRate its sample rate with the rates to resample to, SoundChannels its channels with the layouts to mix to (mono, stereo, 5.1, 7.1), and SoundReadout a plain value beside them. Controlled: the menus send the rate or the layout picked",
    files: [
      {
        path: "audio/elements/sound-readouts.tsx",
        type: "registry:ui",
      },
    ],
    name: "sound-readouts",
    dependencies: ["@audio-ui/engine"],
    registryDependencies: ["@shadcn/dropdown-menu"],
    type: "registry:ui",
  },
  {
    categories: ["audio-editor"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "What a sound was read as, in a dialog: its loudness and true peak, its key and tempo when it has them, and each of ACX's audiobook requirements with whether the sound meets it. Controlled: it is open while a report is set",
    files: [
      {
        path: "audio/elements/sound-report.tsx",
        type: "registry:ui",
      },
    ],
    name: "sound-report",
    registryDependencies: ["@shadcn/dialog"],
    type: "registry:ui",
  },
  {
    categories: ["transport"],
    description:
      "The settings of an export in a dialog: the file's format, its bit depth or bitrate, and its level, left as it is, brought to its peak, or to a loudness target for streaming, podcasts or broadcast. Controlled: Export sends the settings",
    files: [
      {
        path: "audio/elements/export-dialog.tsx",
        type: "registry:ui",
      },
    ],
    name: "export-dialog",
    registryDependencies: [
      "@audio-ui/audio-export",
      "@shadcn/button",
      "@shadcn/dialog",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["piano"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "A menu of commands over a piano roll's notes (split, join, quantize, legato, time commands, fit to scale, chance, velocity), with their keys: items and submenus you place, beside items of your own. The commands come as data in lib/note-edits, to run from keys or a toolbar too.",
    files: [
      {
        path: "audio/elements/note-edit-menu.tsx",
        type: "registry:ui",
      },
      {
        path: "lib/note-edits.ts",
        type: "registry:lib",
      },
    ],
    name: "note-edit-menu",
    registryDependencies: ["@shadcn/button", "@shadcn/dropdown-menu"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "A chromatic tuner on its own: the nearest note with a needle on a scale of cents, a start button and a field for the pitch of A4. Also the display alone, for a tuner of another shape.",
    files: [
      {
        path: "audio/elements/tuner.tsx",
        type: "registry:ui",
      },
    ],
    name: "tuner",
    registryDependencies: [
      "@audio-ui/use-microphone",
      "@audio-ui/use-pitch",
      "@shadcn/button",
      "@shadcn/input",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "knob"],
    dependencies: ["@audio-ui/engine"],
    description:
      "A panel for any device: a knob per number and a toggle per switch, from its descriptors, controlled by a state a host owns.",
    files: [
      {
        path: "audio/panels/device-panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "device-panel",
    registryDependencies: [
      "@audio-ui/knob",
      "@audio-ui/waveform-select",
      "@audio-ui/filter-type-select",
      "@shadcn/toggle",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device-chain"],
    description:
      "A track's devices in a row, each drawn by its own panel: moved by drag or by the arrow keys, folded, switched off and removed, and a device dropped from a library where it goes. Controlled, with no audio in it.",
    files: [
      {
        path: "audio/elements/device-chain.tsx",
        type: "registry:ui",
      },
    ],
    name: "device-chain",
    registryDependencies: [
      "@audio-ui/sortable-drag",
      "@shadcn/button",
      "@shadcn/context-menu",
      "@shadcn/toggle",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/core"],
    description:
      "The face of a rack: eight macros, each with a menu that maps a parameter of a device inside or lets one go, its chains with their volume, switch and solo, and the picked chain's devices, which the host draws.",
    files: [
      {
        path: "audio/panels/rack-panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "rack-panel",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/knob",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
      "@shadcn/slider",
      "@shadcn/toggle",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/core", "@audio-ui/react"],
    description:
      "The face of a drum rack: eight macros, sixteen pads on a bank of the 128 notes, each named for its sound and played when struck, the picked pad's voice, tune, decay and mix, a recording dropped on a pad, and the picked pad's devices, which the host draws.",
    files: [
      {
        path: "audio/panels/drum-rack-panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "drum-rack-panel",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/knob",
      "@audio-ui/pad",
      "@audio-ui/rack-panel",
      "@shadcn/button",
      "@shadcn/input-group",
      "@shadcn/select",
      "@shadcn/toggle",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device-browser"],
    description:
      "A library of devices by shelf, with a search: a device is added with Enter, a double-click or the Add button, or dragged to where it goes on a device chain.",
    files: [
      {
        path: "audio/elements/device-browser.tsx",
        type: "registry:ui",
      },
    ],
    name: "device-browser",
    registryDependencies: [
      "@audio-ui/device-chain",
      "@shadcn/button",
      "@shadcn/input-group",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/engine"],
    description:
      "Every device's panel by the device's stable id, with the width it is drawn at in a row: what draws a track's chain from the ids a project stores, with the face each device has on its own page.",
    files: [
      {
        path: "audio/device-panels.tsx",
        type: "registry:ui",
      },
    ],
    name: "device-panels",
    registryDependencies: [
      "@audio-ui/auto-pan-panel",
      "@audio-ui/channel-eq-panel",
      "@audio-ui/chorus-panel",
      "@audio-ui/compressor-panel",
      "@audio-ui/deesser-panel",
      "@audio-ui/delay-panel",
      "@audio-ui/distortion-panel",
      "@audio-ui/equalizer-panel",
      "@audio-ui/filter-panel",
      "@audio-ui/gate-panel",
      "@audio-ui/limiter-panel",
      "@audio-ui/mid-side-panel",
      "@audio-ui/multiband-panel",
      "@audio-ui/overdrive-panel",
      "@audio-ui/phaser-panel",
      "@audio-ui/vibe-panel",
      "@audio-ui/pocket-synth-panel",
      "@audio-ui/poly-synth-panel",
      "@audio-ui/fm-synth-panel",
      "@audio-ui/mono-synth-panel",
      "@audio-ui/organ-panel",
      "@audio-ui/string-machine-panel",
      "@audio-ui/tape-keys-panel",
      "@audio-ui/guitar-panel",
      "@audio-ui/drum-synth-panel",
      "@audio-ui/sampler-panel",
      "@audio-ui/electric-piano-panel",
      "@audio-ui/redux-panel",
      "@audio-ui/lofi-panel",
      "@audio-ui/unlimiter-panel",
      "@audio-ui/compander-panel",
      "@audio-ui/ducker-panel",
      "@audio-ui/expander-panel",
      "@audio-ui/binaural-panner-panel",
      "@audio-ui/stutter-panel",
      "@audio-ui/rotary-panel",
      "@audio-ui/bass-enhancer-panel",
      "@audio-ui/exciter-panel",
      "@audio-ui/frequency-shifter-panel",
      "@audio-ui/wah-panel",
      "@audio-ui/graphic-eq-panel",
      "@audio-ui/tilt-eq-panel",
      "@audio-ui/reverb-panel",
      "@audio-ui/saturator-panel",
      "@audio-ui/transient-panel",
      "@audio-ui/utility-panel",
      "@audio-ui/wave-shaper-panel",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "synth", "xypad"],
    dependencies: ["@audio-ui/react", "@audio-ui/icons"],
    description:
      "A row of buttons, one per waveform, each drawn as its shape: pick one. Fed by the options of a device's choice parameter.",
    files: [
      {
        path: "audio/elements/waveform-select.tsx",
        type: "registry:ui",
      },
    ],
    name: "waveform-select",
    registryDependencies: ["@shadcn/toggle-group"],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot"],
    dependencies: ["@audio-ui/icons"],
    description:
      "A row of buttons, one per filter type, each drawn as the response it has: low-pass, high-pass, band-pass, notch, low and high cut, low and high shelf, bell. Fed by the options of a device's choice parameter.",
    files: [
      {
        path: "audio/elements/filter-type-select.tsx",
        type: "registry:ui",
      },
    ],
    name: "filter-type-select",
    registryDependencies: ["@shadcn/toggle-group"],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot"],
    dependencies: ["@audio-ui/icons"],
    description:
      "A row of buttons, one per transfer curve, each drawn from the curve itself: you give it the function of each option, so the icon is what the device does and never drifts from it.",
    files: [
      {
        path: "audio/elements/curve-select.tsx",
        type: "registry:ui",
      },
    ],
    name: "curve-select",
    registryDependencies: ["@shadcn/toggle-group"],
    type: "registry:ui",
  },
  {
    categories: ["device", "hooks"],
    dependencies: ["@audio-ui/icons"],
    description:
      "A play and pause button for a demo signal: the icon follows the state, the name says what pressing it does.",
    files: [
      {
        path: "audio/elements/play-toggle.tsx",
        type: "registry:ui",
      },
    ],
    name: "play-toggle",
    registryDependencies: ["@shadcn/button"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "The level of a sound across frequencies, live, on a log axis in hertz, with held peaks.",
    files: [
      {
        path: "audio/elements/spectrum-analyzer.tsx",
        type: "registry:ui",
      },
    ],
    name: "spectrum-analyzer",
    registryDependencies: ["@audio-ui/plot", "@audio-ui/use-spectrum"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "Curves and draggable points, for equalizers, filters and compressors.",
    files: [
      {
        path: "audio/elements/plot.tsx",
        type: "registry:ui",
      },
    ],
    name: "plot",
    type: "registry:ui",
  },
  {
    cssVars: {
      dark: {
        success: "oklch(0.696 0.17 162.48)",
        warning: "oklch(0.795 0.184 86.047)",
      },
      light: {
        success: "oklch(0.696 0.17 162.48)",
        warning: "oklch(0.795 0.184 86.047)",
      },
      theme: {
        "color-success": "var(--success)",
        "color-warning": "var(--warning)",
      },
    },
    dependencies: ["@audio-ui/react"],
    description:
      "A level meter in decibels for one or more channels, with peak hold.",
    files: [
      {
        path: "audio/elements/meter.tsx",
        type: "registry:ui",
      },
    ],
    name: "meter",
    type: "registry:ui",
  },
  {
    dependencies: [],
    description:
      "A track's level for its header: a thin vertical meter of what the engine meters on the track's channel, silent until an engine runs.",
    files: [
      {
        path: "audio/elements/track-level.tsx",
        type: "registry:ui",
      },
    ],
    name: "track-level",
    registryDependencies: ["@audio-ui/meter", "@audio-ui/use-audio-levels"],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/core"],
    description:
      "A needle meter: a dial in dB that a live level moves, with the VU or the PPM ballistics of @audio-ui/core/meter. The needle turns outside React, so the dial does not re-render with the signal.",
    files: [
      {
        path: "audio/elements/needle-meter.tsx",
        type: "registry:ui",
      },
    ],
    name: "needle-meter",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
    description:
      "Draws audio: a seekable waveform with regions and markers, a live waveform that scrolls with the signal, and a bar visualizer.",
    files: [
      {
        path: "audio/elements/waveform.tsx",
        type: "registry:ui",
      },
    ],
    name: "waveform",
    type: "registry:ui",
  },
  {
    categories: ["timeline", "waveform", "knob"],
    dependencies: ["@audio-ui/engine", "@audio-ui/gl", "@audio-ui/react"],
    description:
      "The clip view of an arrangement's audio clip: a strip with its switch and name that rolls the view up, then Clip (start, end), Loop (switch, position, length, ÷2, ×2) and Sample (Warp, Reverse, Crop, Gain, Transpose, speed) boxes in bars.beats.16ths, the last two foldable, beside its source on a timeline of its own (overview, bar ruler, the stretch it plays or loops to drag, warp markers on the waveform), drawn on the GPU when the source's samples are given and WebGL 2 is there: as its waveform, by band, or as its spectrogram, from the view menu. Given onProcess, a Process menu beside it runs the audio editor's operations on the source, and processedSettings says where the clip's start, end and loop go.",
    files: [
      {
        path: "audio/panels/clip-panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "clip-panel",
    registryDependencies: [
      "@audio-ui/clip-waveform",
      "@audio-ui/parameter-field",
      "@audio-ui/clip-view",
      "@audio-ui/timeline",
      "@audio-ui/use-loudest",
      "@audio-ui/sound-lane",
      "@audio-ui/process-menu",
      "@audio-ui/sound-operations",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:ui",
  },
  {
    categories: ["timeline"],
    dependencies: ["@audio-ui/react"],
    description:
      "The frame of a clip's detail view: a strip along its top (the caret that rolls the view up to it, the clip's switch, its name to rename, a status, actions), boxes of its properties beside its editor (ClipBox, foldable to a strip), rows, small toggles, position fields in bars.beats.16ths (parameter fields), and useClipPlayhead, where playback reads the clip's source from the arrangement's position.",
    files: [
      {
        path: "audio/elements/clip-view.tsx",
        type: "registry:ui",
      },
    ],
    name: "clip-view",
    registryDependencies: ["@audio-ui/parameter-field", "@shadcn/button"],
    type: "registry:ui",
  },
  {
    categories: ["sequencer", "pad"],
    dependencies: ["@audio-ui/core"],
    description:
      "A drum clip's notes as steps, a row per pad of the drum rack that plays them: press or paint steps, sound a pad from its name, and fill a row every 2, 4 or 8 steps. The notes stay what the clip keeps, so the piano roll shows the same ones, with their velocity and chance.",
    files: [
      {
        path: "audio/elements/drum-step-editor.tsx",
        type: "registry:ui",
      },
    ],
    name: "drum-step-editor",
    registryDependencies: [
      "@audio-ui/drum-steps",
      "@audio-ui/sequencer",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:ui",
  },
  {
    categories: ["timeline", "piano"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine", "@audio-ui/react"],
    description:
      "The clip view of an arrangement's MIDI clip: a strip with its switch and name that rolls the view up, then Clip (start, end), Loop (switch, position, length, ÷2, ×2, Dupl. Loop), Groove (the swing, on the eighths or the sixteenths, and for a drum clip its steps or its roll), Scale (the clip's scale marked on the roll, Fit notes, and the keys the song's notes are likeliest in; on, transposing by one moves by its steps) and Notes (transpose, invert, reverse, legato, ×2, ÷2, humanize, velocity ramps) boxes, beside its piano roll (Draw, Fold, the loop brace on the ruler, keys, grid, a velocity or chance lane), or for a drum clip its steps, a row per pad. Notes are drawn a grid step at a time.",
    files: [
      {
        path: "audio/panels/midi-clip-panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "midi-clip-panel",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/clip-view",
      "@audio-ui/drum-step-editor",
      "@audio-ui/knob",
      "@audio-ui/piano-roll",
      "@audio-ui/scale-menu",
      "@audio-ui/timeline",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/engine", "@audio-ui/react", "@audio-ui/icons"],
    description:
      "A zoomable timeline for arrangement views and editors, with a ruler that seeks, lanes and a playhead.",
    files: [
      {
        path: "audio/elements/timeline.tsx",
        type: "registry:ui",
      },
    ],
    name: "timeline",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/fader",
      "@audio-ui/knob",
      "@audio-ui/led",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/context-menu",
      "@shadcn/dropdown-menu",
      "@shadcn/toggle-group",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@base-ui/react"],
    description:
      "A tempo field on its own: type it, step it with the arrows, or drag its unit to scrub the value.",
    files: [
      {
        path: "audio/elements/bpm-control.tsx",
        type: "registry:ui",
      },
    ],
    name: "bpm-control",
    registryDependencies: ["@audio-ui/parameter-field"],
    type: "registry:ui",
  },
  {
    dependencies: ["@base-ui/react", "class-variance-authority"],
    description:
      "A parameter's value as a field: type it, step it with the arrows (Shift for large steps, Alt for small), or drag its label or unit to scrub it, sideways or up and down, with a unit, precision and steppers.",
    files: [
      {
        path: "audio/elements/parameter-field.tsx",
        type: "registry:ui",
      },
    ],
    name: "parameter-field",
    registryDependencies: ["@shadcn/input-group"],
    type: "registry:ui",
  },
  {
    dependencies: ["class-variance-authority"],
    description:
      "A status light that glows in its tone when lit and stays a dim dot when off, blinking for an armed take: recording, signal, mute.",
    files: [
      {
        path: "audio/elements/led.tsx",
        type: "registry:ui",
      },
    ],
    name: "led",
    type: "registry:ui",
  },
  {
    dependencies: ["class-variance-authority"],
    description:
      "A small screen, as on a synth: the foreground as its glass and the background as lit figures, holding a reading under a caption, in light and dark alike.",
    files: [
      {
        path: "audio/elements/lcd.tsx",
        type: "registry:ui",
      },
    ],
    name: "lcd",
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/engine", "class-variance-authority"],
    description:
      "An audio value as it reads, in steady monospace figures: tempo, level in dB, frequency in Hz or kHz, pan, percent, semitones, time.",
    files: [
      {
        path: "audio/elements/value-display.tsx",
        type: "registry:ui",
      },
    ],
    name: "value-display",
    type: "registry:ui",
  },
  {
    dependencies: ["@base-ui/react", "class-variance-authority"],
    description:
      "A rocker switch, as on a mixer or a synth: two sides, the one pressed down sunk into the panel, upright or laid down, with a switch's role and keyboard.",
    files: [
      {
        path: "audio/elements/rocker-switch.tsx",
        type: "registry:ui",
      },
    ],
    name: "rocker-switch",
    type: "registry:ui",
  },
  {
    description:
      "A button that connects the page's MIDI input, with the device's name beside it. Renders nothing when the browser has no Web MIDI.",
    files: [
      {
        path: "audio/elements/midi-connect-control.tsx",
        type: "registry:ui",
      },
    ],
    name: "midi-connect-control",
    registryDependencies: [
      "@audio-ui/use-midi-input",
      "@shadcn/button",
      "@shadcn/button-group",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react", "@audio-ui/icons"],
    description:
      "A step grid: press a step, or drag across several, to draw a pattern.",
    files: [
      {
        path: "audio/elements/sequencer.tsx",
        type: "registry:ui",
      },
      {
        path: "components/sequencer/sequencer-demo.tsx",
        target: "components/audio-ui/sequencer-default.tsx",
        type: "registry:component",
      },
    ],
    name: "sequencer",
    registryDependencies: [
      "@audio-ui/use-master-bus",
      "@audio-ui/use-transport-clock",
      "@audio-ui/web-audio",
      "@audio-ui/drum-synthesis",
      "@shadcn/button",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react", "@audio-ui/icons", "@audio-ui/engine"],
    description:
      "A compact player: play and pause, the position, a seek bar and the length.",
    files: [
      {
        path: "audio/elements/scrubber.tsx",
        type: "registry:ui",
      },
      {
        path: "components/scrubber/scrubber-demo.tsx",
        target: "components/audio-ui/scrubber-default.tsx",
        type: "registry:component",
      },
    ],
    name: "scrubber",
    registryDependencies: ["@shadcn/button"],
    type: "registry:ui",
  },
  {
    description:
      "DAW transport controls: play, pause and stop, the position in bars, beats and sixteenths, loop and metronome toggles, tempo and time signature.",
    files: [
      {
        path: "audio/elements/transport.tsx",
        type: "registry:ui",
      },
      {
        path: "components/transport/transport-demo.tsx",
        target: "components/audio-ui/transport-default.tsx",
        type: "registry:component",
      },
    ],
    name: "transport",
    dependencies: ["@audio-ui/react", "@audio-ui/icons", "@audio-ui/engine"],
    registryDependencies: [
      "@audio-ui/bpm-control",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/dropdown-menu",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/engine", "@audio-ui/react"],
    description:
      "The arrangement of a workstation, controlled: the loop, the ruler, the locators and time signatures, a row per track with its header, meter, automation and clips, the return and group tracks, and the row that takes files and devices dropped on it. State comes in through the arrangement's hooks and every change goes out as a command or a callback, so it runs over an engine of your own.",
    files: [
      {
        path: "audio/elements/arrangement-view.tsx",
        type: "registry:ui",
      },
    ],
    name: "arrangement-view",
    registryDependencies: [
      "@audio-ui/drum-kit",
      "@audio-ui/arranged-clip",
      "@audio-ui/arrangement",
      "@audio-ui/arrangement-engine",
      "@audio-ui/device-chain",
      "@audio-ui/timeline",
      "@audio-ui/timeline-markers",
      "@audio-ui/track-automation",
      "@audio-ui/track-level",
      "@audio-ui/use-arrangement",
      "@audio-ui/use-marquee-selection",
      "@audio-ui/use-time-selection",
      "@audio-ui/use-timeline-grid",
      "@audio-ui/use-timeline-zoom",
      "@audio-ui/use-track-reorder",
      "@shadcn/button",
      "@shadcn/context-menu",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:ui",
  },
  {
    categories: ["mixer"],
    dependencies: ["@audio-ui/engine", "@audio-ui/react"],
    description:
      "The mixer of an arrangement, controlled: a channel for each track and return, then the main track. Each has its pan, its sends, its fader, its meter and its peak, and Solo, Mute and an Arm light; the main track reads its loudness in LUFS and stays in sight at the right while the channels scroll, and a channel moves by its name. Every change is a command of the arrangement.",
    files: [
      {
        path: "audio/elements/mixer-view.tsx",
        type: "registry:ui",
      },
    ],
    name: "mixer-view",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/arrangement-engine",
      "@audio-ui/fader",
      "@audio-ui/knob",
      "@audio-ui/led",
      "@audio-ui/meter",
      "@audio-ui/sortable-drag",
      "@audio-ui/timeline",
      "@audio-ui/track-automation",
      "@audio-ui/use-arrangement",
      "@audio-ui/use-audio-levels",
      "@audio-ui/use-loudness",
      "@shadcn/toggle-group",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device-chain"],
    dependencies: ["@audio-ui/core", "@audio-ui/engine"],
    description:
      "The devices of one track of an arrangement, controlled: its chain in a row, each device drawn by its own panel, racks with their macros, chains and zones, drum racks with their pads, devices dropped from a library where they go, and the end of the chain that opens the library or adds a rack. Every change is a command of the arrangement, and what a view remembers, such as a slot folded, goes through a hook you can give.",
    files: [
      {
        path: "audio/elements/device-view.tsx",
        type: "registry:ui",
      },
    ],
    name: "device-view",
    registryDependencies: [
      "@audio-ui/arrangement",
      "@audio-ui/device-chain",
      "@audio-ui/device-library",
      "@audio-ui/device-panels",
      "@audio-ui/drum-kit",
      "@audio-ui/drum-rack-panel",
      "@audio-ui/rack-panel",
      "@audio-ui/track-automation",
      "@audio-ui/use-arrangement",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
    ],
    type: "registry:ui",
  },
  {
    description:
      "The parts of an arrangement editor in one install: the timeline, its zoom and grid, the arrangement's state, its clips, markers and automation, track reordering and MIDI playback. block-timeline wires them into a screen.",
    files: [],
    name: "arrangement-editor",
    registryDependencies: [
      "@audio-ui/timeline",
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
      "@audio-ui/arranged-clip",
      "@audio-ui/arrangement-view",
      "@audio-ui/timeline-markers",
      "@audio-ui/track-automation",
      "@audio-ui/use-track-reorder",
      "@audio-ui/use-marquee-selection",
      "@audio-ui/use-timeline-zoom",
      "@audio-ui/use-timeline-grid",
      "@audio-ui/use-time-selection",
      "@audio-ui/use-timeline-cursor",
    ],
    type: "registry:ui",
  },
];
