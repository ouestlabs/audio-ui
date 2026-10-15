/**
 * Curated category list for the component catalog, the single hand-edited
 * source for category editorial content.
 *
 * `components.json`, `registry.json`, and `seo.json` are GENERATED from this
 * file and the `_registry.ts` modules by `bun run registry:build`, never
 * edit those JSONs by hand.
 *
 * A category listed here must have at least one catalog item carrying its
 * name (the build fails otherwise). Item tags that are not listed here
 * (e.g. `ui`, `grid`, `widget`, `sortable`) are free-form search tags, not
 * categories, they get no page, no count, no SEO.
 */

export interface CategorySeoOverrides {
  /** Defaults to `"${description} {{count}} components."` */
  description?: string;
  /** Defaults to `"Browse {{count}} ${label.toLowerCase()} components for audio/ui, built on top of shadcn/ui."` */
  intro?: string;
  /** Defaults to `label`. */
  title?: string;
}

export interface CategoryDef {
  description: string;
  label: string;
  name: string;
  seo?: CategorySeoOverrides;
}

export interface RootSeo {
  description: string;
  intro: string;
  keywords: string[];
  title: string;
}

export const rootSeo: RootSeo = {
  description:
    "Accessible, composable Audio UI components for React. {{count}} copy-ready blocks and demos covering players, faders, knobs, XY pads, and transport controls, built on top of shadcn/ui.",
  intro:
    "Browse {{count}} audio/ui components for React and Tailwind CSS. Built on shadcn/ui and @audio-ui/react's headless primitives, every block is copy-ready and fully compatible with your shadcn/ui setup.",
  keywords: [
    "audio ui components",
    "react audio components",
    "shadcn audio components",
    "web audio react",
    "audio player react",
    "knob component react",
    "fader component react",
    "xy pad react",
    "channel strip react",
    "shadcn/ui audio",
  ],
  title: "Audio UI Components",
};

/** Display order here is the display order everywhere. */
export const categories: CategoryDef[] = [
  {
    description:
      "Interactive envelope components for editing linear ramp breakpoints.",
    label: "Envelope",
    name: "envelope",
  },
  {
    description: "Fader components for level, gain, and mix controls.",
    label: "Fader",
    name: "fader",
  },
  {
    description:
      "Rotary knob components for continuous parameters like level, cutoff, and pan.",
    label: "Knob",
    name: "knob",
  },
  {
    description:
      "Decibel meter components for monitoring stereo and multi-channel audio levels.",
    label: "Meter",
    name: "meter",
  },
  {
    description:
      "Plots for drawing curves and dragging points on them: equalizers, filters and compressors.",
    label: "Plot",
    name: "plot",
  },
  {
    description:
      "Drum pad grids: strike them by pointer or keyboard, with velocity and choke groups.",
    label: "Pad",
    name: "pad",
  },
  {
    description:
      "Virtual piano keyboard components with MIDI note ranges and glissando.",
    label: "Piano",
    name: "piano",
  },
  {
    description:
      "Synth control patterns combining knobs, XY pads, and toggles.",
    label: "Synth",
    name: "synth",
  },
  {
    description:
      "Step sequencer components: grids of steps to draw a pattern on, that you can hear.",
    label: "Sequencer",
    name: "sequencer",
  },
  {
    description: "Seek bars: play or pause, position and a bar to scrub on.",
    label: "Scrubber",
    name: "scrubber",
  },
  {
    description:
      "Transport controls: return to start, play, stop, record and loop, with the position in bars and beats and the tempo.",
    label: "Transport",
    name: "transport",
  },
  {
    description:
      "Zoomable, snapping timeline components for arrangements, clip editors and piano rolls.",
    label: "Timeline",
    name: "timeline",
  },
  {
    description:
      "Seekable waveform components for scrubbing and visualizing audio playback.",
    label: "Waveform",
    name: "waveform",
  },
  {
    description:
      "Two-dimensional XY pad components for filter and effect controls.",
    label: "XY Pad",
    name: "xypad",
  },
];
