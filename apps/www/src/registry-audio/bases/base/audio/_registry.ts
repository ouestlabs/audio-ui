import type { RegistryItem } from "shadcn/schema";

/**
 * The devices, each installed in one: its state, its engine and its panel,
 * to `components/audio-ui/devices/<name>/`. Each piece stays an item of its
 * own, for a panel over an engine of your own or an engine with no panel.
 */
const DEVICES = [
  "auto-pan",
  "channel-eq",
  "chorus",
  "compressor",
  "deesser",
  "delay",
  "distortion",
  "equalizer",
  "filter",
  "gate",
  "limiter",
  "mid-side",
  "multiband",
  "overdrive",
  "phaser",
  "pocket-synth",
  "redux",
  "reverb",
  "saturator",
  "transient",
  "utility",
  "wave-shaper",
];

const devices = DEVICES.map(
  (name): RegistryItem => ({
    categories: ["device"],
    description: `The ${name.replaceAll("-", " ")} device in one install: its state, its Web Audio engine and its panel, to components/audio-ui/devices/${name}/.`,
    files: [],
    name,
    registryDependencies: [
      `@audio-ui/${name}-device`,
      `@audio-ui/${name}-engine`,
      `@audio-ui/${name}-panel`,
    ],
    type: "registry:ui",
  })
);

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
    name: "automation-envelope",
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
    dependencies: ["@audio-ui/core"],
    description:
      "A menu that picks a root and a scale and turns the scale on or off, in parts you place, beside items of your own.",
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
    categories: ["piano"],
    dependencies: ["@audio-ui/core"],
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
    categories: ["piano"],
    dependencies: ["@audio-ui/core"],
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
      "The note and the pitch of a sound, live from the microphone, with a needle on a scale of cents.",
    files: [
      {
        path: "audio/elements/tuner.tsx",
        type: "registry:ui",
      },
    ],
    name: "tuner",
    registryDependencies: ["@audio-ui/use-pitch"],
    type: "registry:ui",
  },
  {
    categories: ["device", "knob"],
    dependencies: ["@audio-ui/core"],
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
    categories: ["device", "plot"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the compressor device: the transfer curve it plays, with the threshold and the level going in on it, over the device's knobs.",
    files: [
      {
        path: "audio/panels/compressor-panel.tsx",
        target: "components/audio-ui/devices/compressor/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "compressor-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/compressor-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "synth", "xypad"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the Pocket Synth device: a pad that plays it, its waveform and filter, and its volume. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "audio/panels/pocket-synth-panel.tsx",
        target: "components/audio-ui/devices/pocket-synth/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "pocket-synth-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/fader",
      "@audio-ui/waveform-select",
      "@audio-ui/xypad",
      "@audio-ui/pocket-synth-device",
      "@shadcn/toggle-group",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "synth", "xypad"],
    dependencies: ["@audio-ui/react"],
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
    dependencies: [],
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
    dependencies: [],
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
    dependencies: [],
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
    categories: ["device", "synth", "xypad"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the Wave Shaper device: a pad that plays it, its waveform and its knobs. Controlled, with the notes leaving through onNoteOn and onNoteOff.",
    files: [
      {
        path: "audio/panels/wave-shaper-panel.tsx",
        target: "components/audio-ui/devices/wave-shaper/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "wave-shaper-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/waveform-select",
      "@audio-ui/xypad",
      "@audio-ui/wave-shaper-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the delay device: the echoes it makes, one line each and fainter as they fade, with a handle on the first to drag its time and feedback, over the device's knobs.",
    files: [
      {
        path: "audio/panels/delay-panel.tsx",
        target: "components/audio-ui/devices/delay/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "delay-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/delay-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the reverb device: the tail it makes, its level falling to -60 dB, with a handle where it ends to drag the decay time, over the device knobs.",
    files: [
      {
        path: "audio/panels/reverb-panel.tsx",
        target: "components/audio-ui/devices/reverb/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "reverb-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/reverb-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the filter device: the curve it plays with a handle on the cutoff to drag its frequency and resonance, an optional live spectrum behind it, over the device knobs.",
    files: [
      {
        path: "audio/panels/filter-panel.tsx",
        target: "components/audio-ui/devices/filter/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "filter-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/filter-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the distortion device: its transfer curve against the straight line of a clean sound, over the device knobs.",
    files: [
      {
        path: "audio/panels/distortion-panel.tsx",
        target: "components/audio-ui/devices/distortion/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "distortion-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/distortion-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the chorus device: the delay time as the oscillator sweeps it over two seconds, over the device knobs.",
    files: [
      {
        path: "audio/panels/chorus-panel.tsx",
        target: "components/audio-ui/devices/chorus/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "chorus-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/chorus-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the utility device: its gain, pan and width as knobs and its mono and invert switches.",
    files: [
      {
        path: "audio/panels/utility-panel.tsx",
        target: "components/audio-ui/devices/utility/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "utility-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/utility-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the limiter device: its transfer curve against the straight line of a clean sound with a handle for the ceiling and the input gain, over the device knobs.",
    files: [
      {
        path: "audio/panels/limiter-panel.tsx",
        target: "components/audio-ui/devices/limiter/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "limiter-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/limiter-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the gate device: its transfer curve against the straight line of a clean sound with a handle on the threshold, over the device knobs.",
    files: [
      {
        path: "audio/panels/gate-panel.tsx",
        target: "components/audio-ui/devices/gate/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "gate-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/gate-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the saturator device: its transfer curve against the straight line of a clean sound, over the device knobs and the choice of curve.",
    files: [
      {
        path: "audio/panels/saturator-panel.tsx",
        target: "components/audio-ui/devices/saturator/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "saturator-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/curve-select",
      "@audio-ui/plot",
      "@audio-ui/saturator-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the phaser-flanger device: the sweep of its oscillator over two seconds, over the device knobs, with the ones the mode does not use drawn off.",
    files: [
      {
        path: "audio/panels/phaser-panel.tsx",
        target: "components/audio-ui/devices/phaser/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "phaser-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/phaser-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the auto pan device: what the oscillator does to the pan or the level over two seconds, over the device knobs.",
    files: [
      {
        path: "audio/panels/auto-pan-panel.tsx",
        target: "components/audio-ui/devices/auto-pan/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "auto-pan-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/auto-pan-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the channel EQ device: the curve it plays with a handle on the mid band and an optional live spectrum, over the shelf knobs and the high-pass switch.",
    files: [
      {
        path: "audio/panels/channel-eq-panel.tsx",
        target: "components/audio-ui/devices/channel-eq/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "channel-eq-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/channel-eq-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the overdrive device: the band that reaches the clip with a handle on its centre, over the device knobs.",
    files: [
      {
        path: "audio/panels/overdrive-panel.tsx",
        target: "components/audio-ui/devices/overdrive/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "overdrive-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/overdrive-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the de-esser device: what it does at each frequency with a handle at the frequency to drag across and up or down for the range, over the device knobs.",
    files: [
      {
        path: "audio/panels/deesser-panel.tsx",
        target: "components/audio-ui/devices/deesser/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "deesser-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/deesser-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the multiband compressor device: the three bands drawn against frequency with a handle on each split, over the knobs of each band.",
    files: [
      {
        path: "audio/panels/multiband-panel.tsx",
        target: "components/audio-ui/devices/multiband/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "multiband-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/multiband-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the transient shaper device: a square with the sustain across and the attack up, and a handle to drag to both at once, over the output knob.",
    files: [
      {
        path: "audio/panels/transient-panel.tsx",
        target: "components/audio-ui/devices/transient/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "transient-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/transient-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the mid/side device: a square with the side level across and the mid level up, and a handle to drag to both at once, over the bass mono knob.",
    files: [
      {
        path: "audio/panels/mid-side-panel.tsx",
        target: "components/audio-ui/devices/mid-side/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "mid-side-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/mid-side-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the redux device: the stairs the bits make against the straight line of a clean sound, over the device knobs.",
    files: [
      {
        path: "audio/panels/redux-panel.tsx",
        target: "components/audio-ui/devices/redux/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "redux-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/redux-device",
    ],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot", "knob"],
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "The face of the equalizer device: the curve it plays with a handle on each band to drag its frequency and gain, an optional live spectrum behind it, over the device's knobs gathered by band.",
    files: [
      {
        path: "audio/panels/equalizer-panel.tsx",
        target: "components/audio-ui/devices/equalizer/panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "equalizer-panel",
    registryDependencies: [
      "@audio-ui/device-panel",
      "@audio-ui/plot",
      "@audio-ui/equalizer-device",
      "@audio-ui/filter-type-select",
      "@shadcn/toggle",
    ],
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
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    description:
      "Curves and draggable points, for equalizers, filters and compressors.",
    files: [
      {
        path: "audio/elements/plot.tsx",
        type: "registry:ui",
      },
      {
        path: "components/plot/plot-demo.tsx",
        target: "components/audio-ui/plot-default.tsx",
        type: "registry:component",
      },
    ],
    name: "plot",
    registryDependencies: [
      "@audio-ui/knob",
      "@audio-ui/use-noise-through-eq",
      "@audio-ui/use-spectrum",
      "@shadcn/button",
      "@shadcn/popover",
      "@shadcn/select",
    ],
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
    dependencies: ["@audio-ui/react"],
    description:
      "Draws audio: a seekable waveform with regions and markers, a live waveform that scrolls with the signal, and a bar visualizer.",
    files: [
      {
        path: "audio/elements/waveform.tsx",
        type: "registry:ui",
      },
      {
        path: "components/waveform/waveform-demo.tsx",
        target: "components/audio-ui/waveform-default.tsx",
        type: "registry:component",
      },
    ],
    name: "waveform",
    registryDependencies: [],
    type: "registry:ui",
  },
  {
    categories: ["timeline", "waveform", "knob"],
    dependencies: ["@audio-ui/core", "@audio-ui/react"],
    description:
      "The clip view of an arrangement's audio clip: a strip with its switch and name that rolls the view up, then Clip (start, end), Loop (switch, position, length, ÷2, ×2) and Sample (Warp, Reverse, Crop, Gain, Transpose, speed) boxes in bars.beats.16ths, the last two foldable, beside its source on a timeline of its own (overview, bar ruler, the stretch it plays or loops to drag, warp markers on the waveform).",
    files: [
      {
        path: "audio/panels/clip-panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "clip-panel",
    registryDependencies: ["@audio-ui/clip-view", "@audio-ui/timeline"],
    type: "registry:ui",
  },
  {
    categories: ["timeline"],
    description:
      "The frame of a clip's detail view: a strip along its top (the caret that rolls the view up to it, the clip's switch, its name to rename, a status, actions), boxes of its properties beside its editor (ClipBox, foldable to a strip), rows, small toggles, text fields, and position fields in bars.beats.16ths.",
    files: [
      {
        path: "audio/elements/clip-view.tsx",
        type: "registry:ui",
      },
    ],
    name: "clip-view",
    registryDependencies: ["@shadcn/button"],
    type: "registry:ui",
  },
  {
    categories: ["timeline", "piano"],
    dependencies: ["@audio-ui/core", "@audio-ui/react"],
    description:
      "The clip view of an arrangement's MIDI clip: a strip with its switch and name that rolls the view up, then Clip (start, end), Loop (switch, position, length, ÷2, ×2, Dupl. Loop) and Notes (transpose, invert, reverse, legato, ×2, ÷2, humanize, velocity ramps) boxes, the last two foldable, beside its piano roll (Draw, Fold, the loop brace on the ruler, keys, grid, a velocity or chance lane). Notes are drawn a grid step at a time.",
    files: [
      {
        path: "audio/panels/midi-clip-panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "midi-clip-panel",
    registryDependencies: [
      "@audio-ui/clip-view",
      "@audio-ui/piano-roll",
      "@audio-ui/timeline",
      "@shadcn/button",
    ],
    type: "registry:ui",
  },
  {
    dependencies: ["@audio-ui/react"],
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
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/context-menu",
      "@shadcn/dropdown-menu",
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
    registryDependencies: ["@shadcn/input-group"],
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
    dependencies: ["@audio-ui/react"],
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
    dependencies: ["@audio-ui/react"],
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
    dependencies: ["@audio-ui/react", "@audio-ui/core"],
    registryDependencies: [
      "@audio-ui/bpm-control",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/dropdown-menu",
      "@shadcn/select",
    ],
    type: "registry:ui",
  },
  ...devices,
];
