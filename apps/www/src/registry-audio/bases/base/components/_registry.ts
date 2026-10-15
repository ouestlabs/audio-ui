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
      "@audio-ui/use-web-audio",
      "@audio-ui/fader",
      "@audio-ui/xypad",
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
      "@audio-ui/use-web-audio",
      "@audio-ui/fader",
      "@audio-ui/xypad",
      "@audio-ui/knob",
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
    registryDependencies: ["@audio-ui/fader"],
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
    categories: ["knob"],
    description: "Knob value arc (rail + highlight) and optional anchor range",
    files: [
      {
        path: "components/knob/knob-arc-and-anchor-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-arc-and-anchor-demo",
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
    categories: ["piano", "synth"],
    description:
      "A DAW-style piano roll, laid out like Sona's note editor, a scrolling roll with a playable keyboard stuck to its side, a loop brace and bar ruler stuck on top, a velocity lane stuck at the bottom and a navigator to zoom across four bars: click to add notes, drag to move or resize either edge, Alt-drag to copy, shift-click to select and move several at once, double-click a note to delete it, Fold to keep only the pitches in use, with a BPM-driven loop that plays back in real time and always-on live preview as you edit. A timeline above the grid lets you click to seek or drag out a loop range to dial in a short phrase instead of always looping the whole grid. Drop a MIDI file onto the panel (or use the Import MIDI button) to load its notes and tempo onto the grid, and Export MIDI to save the current pattern back out as a .mid file",
    files: [
      {
        path: "components/piano/block-piano-roll.tsx",
        type: "registry:block",
      },
    ],
    name: "block-piano-roll",
    dependencies: ["@audio-ui/core@^0.3.0"],
    registryDependencies: [
      "@audio-ui/piano-roll",
      "@audio-ui/timeline",
      "@audio-ui/fader",
      "@audio-ui/bpm-control",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-synth-voices",
      "@audio-ui/use-transport-clock",
      "@audio-ui/use-web-audio",
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
    registryDependencies: ["@audio-ui/meter", "@audio-ui/use-simulated-levels"],
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
    registryDependencies: ["@audio-ui/meter", "@audio-ui/use-simulated-levels"],
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
    dependencies: ["@audio-ui/core@^0.5.0"],
    registryDependencies: [
      "@audio-ui/scrubber",
      "@audio-ui/timeline",
      "@audio-ui/waveform",
      "@audio-ui/audio-decode",
      "@shadcn/button",
      "@shadcn/toggle",
    ],
    type: "registry:block",
  },
  {
    categories: ["timeline"],
    description:
      "An arrangement timeline made for a whole screen: a bar ruler that seeks on the grid, a loop strip, a lane per track with clips to move between tracks, trim and fade on the grid, a cursor to put anywhere on a track, and a split at the cursor, a transport with play or pause, stop, loop, a metronome and a tempo and signature that keep the arrangement's musical positions, a playhead following its clock, and a navigator to zoom and scroll, open it at full size and the tracks take the screen",
    files: [
      {
        path: "components/timeline/block-timeline.tsx",
        type: "registry:block",
      },
    ],
    meta: {
      hint: "Click a track or clip to place the cursor, S to split, Cmd/Ctrl + D to duplicate. Drag a clip's title bar to move it (Alt to copy), its edges to trim, its corners to fade. Drag the loop strip to set a loop, M to add a locator, Cmd/Ctrl + scroll to zoom.",
    },
    name: "block-timeline",
    dependencies: ["@audio-ui/core@^0.5.0"],
    registryDependencies: [
      "@audio-ui/timeline",
      "@audio-ui/transport",
      "@audio-ui/bpm-control",
      "@audio-ui/meter",
      "@audio-ui/use-simulated-levels",
      "@audio-ui/arrangement",
      "@audio-ui/use-arrangement",
      "@audio-ui/use-marquee-selection",
      "@audio-ui/use-playback-clock",
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
    description: "Waveform default example",
    files: [
      {
        path: "components/waveform/waveform-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "waveform-demo",
    registryDependencies: ["@audio-ui/waveform"],
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
    registryDependencies: ["@audio-ui/waveform"],
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
    dependencies: ["@audio-ui/core@^0.5.0"],
    registryDependencies: [
      "@audio-ui/plot",
      "@audio-ui/use-noise-through-eq",
      "@audio-ui/use-spectrum",
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
    dependencies: ["@audio-ui/core@^0.5.0"],
    registryDependencies: ["@audio-ui/plot"],
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
    dependencies: ["@audio-ui/core@^0.5.0"],
    registryDependencies: [
      "@audio-ui/plot",
      "@audio-ui/use-pulses-through-compressor",
      "@shadcn/button",
    ],
    type: "registry:example",
  },
  {
    categories: ["mixer", "fader", "meter", "knob"],
    description:
      "Mixing console: four tracks of a loop with pan, fader, meter, mute and solo, into a master with a stereo meter, every meter reading its real signal",
    files: [
      {
        path: "components/mixer/block-mixer.tsx",
        type: "registry:block",
      },
    ],
    name: "block-mixer",
    dependencies: ["@audio-ui/core@^0.3.0"],
    registryDependencies: [
      "@audio-ui/fader",
      "@audio-ui/knob",
      "@audio-ui/meter",
      "@audio-ui/use-audio-levels",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-transport-clock",
      "@audio-ui/use-web-audio",
      "@audio-ui/drum-synthesis",
      "@audio-ui/envelope-ramp",
      "@shadcn/button",
      "@shadcn/toggle",
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
      "@audio-ui/use-web-audio",
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
      "@audio-ui/use-web-audio",
      "@audio-ui/drum-synthesis",
    ],
    type: "registry:example",
  },
  {
    categories: ["tuner"],
    description:
      "A chromatic tuner on the microphone: the nearest note, a needle on a scale of cents and the frequency, in the primary color when in tune",
    files: [
      {
        path: "components/tuner/tuner-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "tuner-demo",
    registryDependencies: [
      "@audio-ui/tuner",
      "@audio-ui/use-microphone",
      "@audio-ui/use-pitch",
      "@shadcn/button",
    ],
    type: "registry:example",
  },
  {
    categories: ["spectrum"],
    description:
      "Play the keyboard and watch the spectrum: a sawtooth note lights its pitch and every harmonic above it, and the peaks hold a moment",
    files: [
      {
        path: "components/spectrum/spectrum-analyzer-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "spectrum-analyzer-demo",
    registryDependencies: [
      "@audio-ui/spectrum-analyzer",
      "@audio-ui/piano",
      "@audio-ui/use-master-bus",
      "@audio-ui/use-midi-input",
      "@audio-ui/use-spectrum",
      "@audio-ui/use-synth-voices",
      "@audio-ui/use-web-audio",
      "@audio-ui/envelope-ramp",
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
    dependencies: ["@audio-ui/core@^0.5.0"],
    registryDependencies: ["@audio-ui/transport"],
    type: "registry:example",
  },
];
