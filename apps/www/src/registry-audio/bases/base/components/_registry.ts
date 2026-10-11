import type { RegistryItem } from "shadcn/schema";

export const components: RegistryItem[] = [
  {
    categories: ["synth", "xypad"],
    description: "Pocket synth with oscillator, filter, and XY pad",
    files: [
      {
        path: "components/synth/block-pocket-synth.tsx",
        type: "registry:block",
      },
    ],
    name: "block-pocket-synth",
    registryDependencies: [
      "@audio/use-web-audio",
      "@audio/fader",
      "@audio/xypad",
      "@shadcn/toggle-group",
    ],
    type: "registry:block",
  },
  {
    categories: ["synth", "xypad"],
    description: "Wave shaper synth with distortion, tone, and detune controls",
    files: [
      {
        path: "components/synth/block-wave-shaper.tsx",
        type: "registry:block",
      },
    ],
    name: "block-wave-shaper",
    registryDependencies: [
      "@audio/use-web-audio",
      "@audio/fader",
      "@audio/xypad",
      "@audio/knob",
      "@shadcn/toggle-group",
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
    registryDependencies: ["@audio/fader"],
    type: "registry:example",
  },
  {
    categories: ["fader"],
    description: "Fader component example with horizontal orientation",
    files: [
      {
        path: "components/fader/fader-horizontal-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-horizontal-demo",
    registryDependencies: ["@audio/fader"],
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
    registryDependencies: ["@audio/fader"],
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
    registryDependencies: ["@audio/knob"],
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
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob value arc (rail + highlight) and optional anchor range",
    files: [
      {
        path: "components/knob/knob-arc-and-anchor-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-arc-and-anchor-demo",
    registryDependencies: ["@audio/knob"],
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
    registryDependencies: ["@audio/envelope"],
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
    registryDependencies: ["@audio/envelope"],
    type: "registry:example",
  },
  {
    categories: ["envelope"],
    description:
      "Envelope with common audio envelope presets — ADSR, Bass, Gate, Pad, Pluck",
    files: [
      {
        path: "components/envelope/envelope-presets-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "envelope-presets-demo",
    registryDependencies: ["@audio/envelope", "@shadcn/button"],
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
    registryDependencies: ["@audio/piano"],
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
    registryDependencies: ["@audio/piano"],
    type: "registry:example",
  },
  {
    categories: ["piano", "synth"],
    description:
      "A DAW-style piano roll, laid out like Sona's note editor — a scrolling roll with a playable keyboard stuck to its side, a loop brace and bar ruler stuck on top, a velocity lane stuck at the bottom and a navigator to zoom across four bars: click to add notes, drag to move or resize either edge, Alt-drag to copy, shift-click to select and move several at once, double-click a note to delete it, Fold to keep only the pitches in use — with a BPM-driven loop that plays back in real time and always-on live preview as you edit. A timeline above the grid lets you click to seek or drag out a loop range to dial in a short phrase instead of always looping the whole grid. Drop a MIDI file onto the panel (or use the Import MIDI button) to load its notes and tempo onto the grid, and Export MIDI to save the current pattern back out as a .mid file",
    files: [
      {
        path: "components/piano/block-piano-roll.tsx",
        type: "registry:block",
      },
    ],
    name: "block-piano-roll",
    registryDependencies: [
      "@audio/piano-roll",
      "@audio/timeline",
      "@audio/fader",
      "@audio/bpm-control",
      "@audio/midi",
      "@audio/use-master-bus",
      "@audio/use-synth-voices",
      "@audio/use-transport-clock",
      "@shadcn/button",
    ],
    type: "registry:block",
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
    registryDependencies: ["@audio/meter", "@audio/use-simulated-levels"],
    type: "registry:example",
  },
  {
    categories: ["meter"],
    description: "Horizontal meter example",
    files: [
      {
        path: "components/meter/meter-horizontal-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "meter-horizontal-demo",
    registryDependencies: ["@audio/meter", "@audio/use-simulated-levels"],
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
    registryDependencies: ["@audio/xypad"],
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
    registryDependencies: ["@audio/xypad"],
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
    registryDependencies: [
      "@audio/scrubber",
      "@audio/timeline",
      "@audio/waveform",
      "@audio/waveform-dsp",
      "@shadcn/button",
      "@shadcn/toggle",
    ],
    type: "registry:block",
  },
  {
    categories: ["timeline"],
    description:
      "An arrangement timeline made for a whole screen: a bar ruler that seeks on the grid, a loop strip, a lane per track with clips to move and trim on the grid, a playhead following a transport clock, and a navigator to zoom and scroll — open it at full size and the tracks take the screen",
    files: [
      {
        path: "components/timeline/block-timeline.tsx",
        type: "registry:block",
      },
    ],
    meta: {
      hint: "Drag a clip to move it and its edges to trim it, on the grid unless Cmd/Ctrl is held. Drag across the loop strip to set a loop. Cmd/Ctrl + scroll zooms around the pointer, or drag the bar below.",
    },
    name: "block-timeline",
    registryDependencies: [
      "@audio/timeline",
      "@audio/musical-time",
      "@shadcn/button",
      "@shadcn/button-group",
    ],
    type: "registry:block",
  },
  {
    categories: ["waveform"],
    description: "Waveform default example",
    files: [
      {
        path: "components/waveform/waveform-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "waveform-demo",
    registryDependencies: ["@audio/waveform"],
    type: "registry:example",
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
    registryDependencies: ["@audio/waveform"],
    type: "registry:example",
  },
  {
    categories: ["waveform"],
    description: "Live waveform scrolling with the incoming signal",
    files: [
      {
        path: "components/waveform/waveform-live-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "waveform-live-demo",
    registryDependencies: ["@audio/waveform"],
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
    registryDependencies: [
      "@audio/plot",
      "@audio/filter-response",
      "@audio/use-noise-through-eq",
      "@audio/use-spectrum",
      "@shadcn/button",
    ],
    type: "registry:example",
  },
  {
    categories: ["plot"],
    description:
      "A low-pass filter: one handle on the resonance peak sets the cutoff and how much it rings",
    files: [
      {
        path: "components/plot/plot-filter-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "plot-filter-demo",
    registryDependencies: ["@audio/plot", "@audio/filter-response"],
    type: "registry:example",
  },
  {
    categories: ["plot"],
    description:
      "A compressor transfer curve: one handle sets the threshold, the other the ratio",
    files: [
      {
        path: "components/plot/plot-compressor-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "plot-compressor-demo",
    registryDependencies: [
      "@audio/plot",
      "@audio/filter-response",
      "@audio/use-pulses-through-compressor",
      "@shadcn/button",
    ],
    type: "registry:example",
  },
  {
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
    registryDependencies: ["@audio/sequencer"],
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
    registryDependencies: ["@audio/scrubber"],
    type: "registry:example",
  },
  {
    categories: ["transport"],
    description:
      "The transport of a DAW: return to start, play, stop, record and loop, the position in bars and beats, and the tempo. A clock stands in for the engine",
    files: [
      {
        path: "components/transport/transport-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "transport-demo",
    registryDependencies: ["@audio/transport"],
    type: "registry:example",
  },
];
