/**
 * Curated category list for the component catalog — the single hand-edited
 * source for category editorial content.
 *
 * `components.json`, `registry.json`, and `seo.json` are GENERATED from this
 * file and the `_registry.ts` modules by `bun run registry:build` — never
 * edit those JSONs by hand.
 *
 * A category listed here must have at least one catalog item carrying its
 * name (the build fails otherwise). Item tags that are not listed here
 * (e.g. `ui`, `grid`, `widget`, `sortable`) are free-form search tags, not
 * categories — they get no page, no count, no SEO.
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
      "Channel strip patterns combining faders, knobs, and transport controls.",
    label: "Channel Strip",
    name: "channel-strip",
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
    description: "Playback speed controls for audio and video players.",
    label: "Playback Speed",
    name: "playback-speed",
  },
  {
    description:
      "Audio player components for track playback, queues, and playback speed control.",
    label: "Player",
    name: "player",
  },
  {
    description:
      "Queue management components for building playlists and up-next lists.",
    label: "Queue",
    name: "queue",
  },
  {
    description:
      "Drag-and-drop sortable list components for reordering tracks and items.",
    label: "Sortable List",
    name: "sortable-list",
  },
  {
    description:
      "Synth control patterns combining knobs, XY pads, and toggles.",
    label: "Synth",
    name: "synth",
  },
  {
    description: "Track list and grid components for browsing audio content.",
    label: "Track",
    name: "track",
  },
  {
    description: "Transport controls for play, pause, and seek.",
    label: "Transport",
    name: "transport",
  },
  {
    description:
      "Two-dimensional XY pad components for filter and effect controls.",
    label: "XY Pad",
    name: "xypad",
  },
];
