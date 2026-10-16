import type { RegistryItem } from "shadcn/schema";

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
        path: "audio/elements/device-panel.tsx",
        type: "registry:ui",
      },
    ],
    name: "device-panel",
    registryDependencies: ["@audio-ui/knob", "@shadcn/toggle"],
    type: "registry:ui",
  },
  {
    categories: ["device", "plot"],
    dependencies: ["@audio-ui/react"],
    description:
      "The face of the compressor device: the transfer curve it plays, with the threshold and the level going in on it, over the device's knobs.",
    files: [
      {
        path: "audio/elements/compressor-panel.tsx",
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
];
