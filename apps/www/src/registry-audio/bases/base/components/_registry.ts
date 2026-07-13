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
    categories: ["player", "queue"],
    description: "Audio player",
    files: [
      {
        path: "components/player/block-player.tsx",
        type: "registry:block",
      },
    ],
    name: "block-player",
    registryDependencies: ["@audio/player", "@audio/store", "@audio/html"],
    type: "registry:block",
  },
  {
    categories: ["player", "widget"],
    description: "Audio player with track list",
    files: [
      {
        path: "components/player/block-player-widget.tsx",
        type: "registry:block",
      },
    ],
    name: "block-player-widget",
    registryDependencies: ["@audio/player", "@audio/store", "@audio/html"],
    type: "registry:block",
  },
  {
    categories: ["queue", "ui"],
    description: "Queue controls",
    files: [
      {
        path: "components/queue/block-queue.tsx",
        type: "registry:block",
      },
    ],
    name: "block-queue",
    registryDependencies: ["@audio/player"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "transport"],
    description:
      "Channel strip with transport seek bar in vertical orientation",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-transport-vertical.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-transport-vertical",
    registryDependencies: ["@audio/channel-strip", "@audio/transport"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "transport"],
    description:
      "Channel strip with transport seek bar in horizontal orientation",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-transport.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-transport",
    registryDependencies: ["@audio/channel-strip", "@audio/transport"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with fader, header, and footer",
    files: [
      {
        path: "components/channel-strip/block-channel-strip.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with fader in horizontal orientation",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-horizontal.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-horizontal",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with a minimal fader section",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with bipolar gain fader (-60 dB to +6 dB)",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-gain-db.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader-gain-db",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader"],
    description: "Multiple fader channel strips in a row",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-multi.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader-multi",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob"],
    description: "Multiple knob channel strips in a row",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-multi.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-multi",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description:
      "Channel strip with a minimal fader section in horizontal orientation",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-horizontal.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader-horizontal",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "fader", "ui"],
    description: "Channel strip with horizontal fader and inline label",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-fader-slider.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-fader-slider",
    registryDependencies: ["@audio/channel-strip", "@audio/fader"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob", "ui"],
    description: "Channel strip with a level knob",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-level.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-level",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob", "ui"],
    description: "Channel strip with an oversized macro knob",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-macro.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-macro",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob", "ui"],
    description: "Channel strip with a bipolar pan knob",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-pan.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-pan",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "knob", "ui"],
    description: "Channel strip with pan and width knobs in a row",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-knob-pan-width.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-knob-pan-width",
    registryDependencies: ["@audio/channel-strip", "@audio/knob"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "xypad", "ui"],
    description: "Channel strip with an XY filter pad",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-xypad-filter.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-xypad-filter",
    registryDependencies: ["@audio/channel-strip", "@audio/xypad"],
    type: "registry:block",
  },
  {
    categories: ["channel-strip", "xypad", "ui"],
    description: "Channel strip with XY spatial pad and wet knob",
    files: [
      {
        path: "components/channel-strip/block-channel-strip-xypad-reverb.tsx",
        type: "registry:block",
      },
    ],
    name: "block-channel-strip-xypad-reverb",
    registryDependencies: [
      "@audio/channel-strip",
      "@audio/xypad",
      "@audio/knob",
    ],
    type: "registry:block",
  },
  {
    categories: ["player"],
    description: "Audio player demo",
    files: [
      {
        path: "components/player/player-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["player", "queue"],
    description: "Audio player with queue demo",
    files: [
      {
        path: "components/player/player-queue-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["player"],
    description: "AudioPlayer variant options (default, outline, ghost)",
    files: [
      {
        path: "components/player/player-variant-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-variant-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["player"],
    description: "AudioPlayer size options (sm, default, lg)",
    files: [
      {
        path: "components/player/player-size-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-size-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["player"],
    description: "Audio player with stacked layout",
    files: [
      {
        path: "components/player/player-stacked-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-stacked-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["queue"],
    description: "Minimal queue with shuffle and repeat controls",
    files: [
      {
        path: "components/queue/player-queue-shuffle-repeat-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-shuffle-repeat-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["queue"],
    description: "Minimal queue with preferences dropdown",
    files: [
      {
        path: "components/queue/player-queue-preferences-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-preferences-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["queue"],
    description: "Stacked player with queue and preferences",
    files: [
      {
        path: "components/queue/player-queue-simple-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-simple-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["queue"],
    description: "Queue with all controls (shuffle, repeat, preferences)",
    files: [
      {
        path: "components/queue/player-queue-all-controls-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-queue-all-controls-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["track"],
    description: "Minimal track component example",
    files: [
      {
        path: "components/track/player-track-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
  },
  {
    categories: ["track"],
    description: "Track list with selection example",
    files: [
      {
        path: "components/track/player-track-list-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-list-demo",
    registryDependencies: ["@audio/player", "@audio/store"],
    type: "registry:example",
  },
  {
    categories: ["track", "grid"],
    description: "Track list with grid layout example",
    files: [
      {
        path: "components/track/player-track-list-grid-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-list-grid-demo",
    registryDependencies: ["@audio/player", "@audio/store"],
    type: "registry:example",
  },
  {
    categories: ["track", "sortable"],
    description: "Track list with sortable selection example",
    files: [
      {
        path: "components/track/player-track-sortable-list-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-sortable-list-demo",
    registryDependencies: ["@audio/player", "@audio/store"],
    type: "registry:example",
  },
  {
    categories: ["track", "sortable", "grid"],
    description: "Track list with sortable selection and grid layout example",
    files: [
      {
        path: "components/track/player-track-sortable-list-grid-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-track-sortable-list-grid-demo",
    registryDependencies: ["@audio/player", "@audio/store"],
    type: "registry:example",
  },
  {
    categories: ["transport", "ui"],
    description: "Transport timeline with buffered range example",
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
  {
    categories: ["sortable-list", "ui"],
    description: "Sortable list component examples",
    files: [
      {
        path: "components/sortable-list/sortable-list-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sortable-list-demo",
    registryDependencies: ["@audio/sortable-list"],
    type: "registry:example",
  },
  {
    categories: ["playback-speed"],
    description: "Playback speed component example",
    files: [
      {
        path: "components/playback-speed/player-playback-speed-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "player-playback-speed-demo",
    registryDependencies: ["@audio/player"],
    type: "registry:example",
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
    description: "Fader size variants (sm, default, lg)",
    files: [
      {
        path: "components/fader/fader-size-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-size-variants-demo",
    registryDependencies: ["@audio/fader"],
    type: "registry:example",
  },
  {
    categories: ["fader"],
    description: "Fader thumb marks variants (off, 1, 4)",
    files: [
      {
        path: "components/fader/fader-thumb-marks-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "fader-thumb-marks-variants-demo",
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
    description: "Knob disabled vs enabled comparison",
    files: [
      {
        path: "components/knob/knob-disabled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-disabled-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob component example with size variants",
    files: [
      {
        path: "components/knob/knob-size-variants-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-size-variants-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob with fine-grained step control (0.01)",
    files: [
      {
        path: "components/knob/knob-fine-step-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-fine-step-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob component example with filter control",
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
    description: "Knob live value vs committed value callbacks",
    files: [
      {
        path: "components/knob/knob-change-vs-commit-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-change-vs-commit-demo",
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
    categories: ["knob"],
    description: "Knob with default arc pointer mapping and live value",
    files: [
      {
        path: "components/knob/knob-circular-arc-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-circular-arc-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob double-tap / double-click reset to defaultValue",
    files: [
      {
        path: "components/knob/knob-double-tap-reset-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-double-tap-reset-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description: "Knob with revolution (360°) drag sensitivity",
    files: [
      {
        path: "components/knob/knob-revolution-drag-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-revolution-drag-demo",
    registryDependencies: ["@audio/knob"],
    type: "registry:example",
  },
  {
    categories: ["knob"],
    description:
      "Knob with vertical fader-style pan via dragOptions.verticalPanEnabled",
    files: [
      {
        path: "components/knob/knob-vertical-drag-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "knob-vertical-drag-demo",
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
        path: "components/envelope/envelope-controlled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "envelope-controlled-demo",
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
    categories: ["envelope"],
    description: "Envelope with adding and removing points disabled",
    files: [
      {
        path: "components/envelope/envelope-no-new-points-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "envelope-no-new-points-demo",
    registryDependencies: ["@audio/envelope"],
    type: "registry:example",
  },
  {
    categories: ["envelope"],
    description: "Envelope size small example",
    files: [
      {
        path: "components/envelope/envelope-size-sm-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "envelope-size-sm-demo",
    registryDependencies: ["@audio/envelope"],
    type: "registry:example",
  },
  {
    categories: ["envelope"],
    description: "Envelope size large example",
    files: [
      {
        path: "components/envelope/envelope-size-lg-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "envelope-size-lg-demo",
    registryDependencies: ["@audio/envelope"],
    type: "registry:example",
  },
  {
    categories: ["envelope"],
    description: "Disabled envelope example",
    files: [
      {
        path: "components/envelope/envelope-disabled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "envelope-disabled-demo",
    registryDependencies: ["@audio/envelope"],
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
    description: "Piano with onNoteOn/onNoteOff events",
    files: [
      {
        path: "components/piano/piano-note-events-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "piano-note-events-demo",
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
    categories: ["piano"],
    description: "Piano size small example",
    files: [
      {
        path: "components/piano/piano-size-sm-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "piano-size-sm-demo",
    registryDependencies: ["@audio/piano"],
    type: "registry:example",
  },
  {
    categories: ["piano"],
    description: "Piano size large example",
    files: [
      {
        path: "components/piano/piano-size-lg-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "piano-size-lg-demo",
    registryDependencies: ["@audio/piano"],
    type: "registry:example",
  },
  {
    categories: ["piano"],
    description: "Disabled piano example",
    files: [
      {
        path: "components/piano/piano-disabled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "piano-disabled-demo",
    registryDependencies: ["@audio/piano"],
    type: "registry:example",
  },
  {
    categories: ["piano", "envelope", "synth"],
    description:
      "Polyphonic synth keyboard shaped by a visual ADSR envelope, playable by mouse/touch or a connected MIDI keyboard — hold a key through attack/decay into sustain, release to hear the envelope's tail",
    files: [
      {
        path: "components/piano/block-polysynth.tsx",
        type: "registry:block",
      },
    ],
    name: "block-polysynth",
    registryDependencies: [
      "@audio/piano",
      "@audio/envelope",
      "@audio/fader",
      "@audio/channel-strip",
      "@audio/midi-connect-control",
      "@audio/use-synth-voices",
      "@audio/use-web-audio",
      "@audio/use-midi-input",
    ],
    type: "registry:block",
  },
  {
    categories: ["piano", "synth"],
    description:
      "A DAW-style piano roll — a pitch-reference key strip beside an editable note grid, click to add notes, drag to move or resize either edge, shift-click to select and move several at once, double-click to delete — with a BPM-driven loop that plays back in real time and always-on live preview as you edit. A ruler above the grid lets you click to seek or drag out a loop region to dial in a short phrase instead of always looping the whole grid. Drop a MIDI file onto the panel (or use the Import MIDI button) to load its notes and tempo onto the grid, and Export MIDI to save the current pattern back out as a .mid file",
    files: [
      {
        path: "components/piano/block-piano-roll.tsx",
        type: "registry:block",
      },
    ],
    name: "block-piano-roll",
    registryDependencies: [
      "@audio/piano-roll",
      "@audio/ruler",
      "@audio/fader",
      "@audio/channel-strip",
      "@audio/bpm-control",
      "@audio/midi",
      "@audio/use-synth-voices",
      "@audio/use-web-audio",
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
    registryDependencies: ["@audio/meter"],
    type: "registry:example",
  },
  {
    categories: ["meter"],
    description: "Meter with simulated live levels and peak-hold decay",
    files: [
      {
        path: "components/meter/meter-live-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "meter-live-demo",
    registryDependencies: ["@audio/meter"],
    type: "registry:example",
  },
  {
    categories: ["meter"],
    description: "Meter showing the clip indicator at 0 dB and above",
    files: [
      {
        path: "components/meter/meter-clipping-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "meter-clipping-demo",
    registryDependencies: ["@audio/meter"],
    type: "registry:example",
  },
  {
    categories: ["meter"],
    description: "Meter size small example",
    files: [
      {
        path: "components/meter/meter-size-sm-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "meter-size-sm-demo",
    registryDependencies: ["@audio/meter"],
    type: "registry:example",
  },
  {
    categories: ["meter"],
    description: "Meter size large example",
    files: [
      {
        path: "components/meter/meter-size-lg-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "meter-size-lg-demo",
    registryDependencies: ["@audio/meter"],
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
    registryDependencies: ["@audio/meter"],
    type: "registry:example",
  },
  {
    categories: ["sequencer"],
    description: "Sequencer size default example",
    files: [
      {
        path: "components/sequencer/sequencer-size-default-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sequencer-size-default-demo",
    registryDependencies: ["@audio/sequencer"],
    type: "registry:example",
  },
  {
    categories: ["sequencer"],
    description: "Playing sequencer driven by the use-step-clock hook",
    files: [
      {
        path: "components/sequencer/sequencer-playing-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sequencer-playing-demo",
    registryDependencies: [
      "@audio/sequencer",
      "@audio/use-step-clock",
      "@shadcn/button",
    ],
    type: "registry:example",
  },
  {
    categories: ["sequencer"],
    description: "Controlled sequencer with a live active-step count",
    files: [
      {
        path: "components/sequencer/sequencer-controlled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sequencer-controlled-demo",
    registryDependencies: ["@audio/sequencer"],
    type: "registry:example",
  },
  {
    categories: ["sequencer"],
    description: "Sequencer size small example",
    files: [
      {
        path: "components/sequencer/sequencer-size-sm-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sequencer-size-sm-demo",
    registryDependencies: ["@audio/sequencer"],
    type: "registry:example",
  },
  {
    categories: ["sequencer"],
    description: "Sequencer size large example",
    files: [
      {
        path: "components/sequencer/sequencer-size-lg-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sequencer-size-lg-demo",
    registryDependencies: ["@audio/sequencer"],
    type: "registry:example",
  },
  {
    categories: ["sequencer"],
    description: "Disabled sequencer example",
    files: [
      {
        path: "components/sequencer/sequencer-disabled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "sequencer-disabled-demo",
    registryDependencies: ["@audio/sequencer"],
    type: "registry:example",
  },
  {
    categories: ["sequencer", "synth"],
    description:
      "Step-sequenced drum machine with real WebAudio kick, snare, and hihat synthesis",
    files: [
      {
        path: "components/sequencer/block-drum-machine.tsx",
        type: "registry:block",
      },
    ],
    name: "block-drum-machine",
    registryDependencies: [
      "@audio/sequencer",
      "@audio/use-step-clock",
      "@audio/use-web-audio",
      "@audio/drum-synthesis",
      "@audio/fader",
      "@audio/channel-strip",
      "@shadcn/button",
      "@shadcn/input-group",
    ],
    type: "registry:block",
  },
  {
    categories: ["multislider"],
    description: "Multislider size default example",
    files: [
      {
        path: "components/multislider/multislider-size-default-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "multislider-size-default-demo",
    registryDependencies: ["@audio/multislider"],
    type: "registry:example",
  },
  {
    categories: ["multislider"],
    description: "Controlled multislider with live value readout",
    files: [
      {
        path: "components/multislider/multislider-controlled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "multislider-controlled-demo",
    registryDependencies: ["@audio/multislider"],
    type: "registry:example",
  },
  {
    categories: ["multislider"],
    description: "Stepped multislider for integer step levels",
    files: [
      {
        path: "components/multislider/multislider-stepped-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "multislider-stepped-demo",
    registryDependencies: ["@audio/multislider"],
    type: "registry:example",
  },
  {
    categories: ["multislider"],
    description: "Horizontal multislider example",
    files: [
      {
        path: "components/multislider/multislider-horizontal-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "multislider-horizontal-demo",
    registryDependencies: ["@audio/multislider"],
    type: "registry:example",
  },
  {
    categories: ["multislider"],
    description: "Multislider with thumb marks visible",
    files: [
      {
        path: "components/multislider/multislider-thumbs-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "multislider-thumbs-demo",
    registryDependencies: ["@audio/multislider"],
    type: "registry:example",
  },
  {
    categories: ["multislider"],
    description: "Disabled multislider example",
    files: [
      {
        path: "components/multislider/multislider-disabled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "multislider-disabled-demo",
    registryDependencies: ["@audio/multislider"],
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
    description: "XYPad size small example",
    files: [
      {
        path: "components/xypad/xypad-size-sm-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-size-sm-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad size default example",
    files: [
      {
        path: "components/xypad/xypad-size-default-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-size-default-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad size large example",
    files: [
      {
        path: "components/xypad/xypad-size-lg-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-size-lg-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad size extra large example",
    files: [
      {
        path: "components/xypad/xypad-size-xl-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-size-xl-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad disabled state example",
    files: [
      {
        path: "components/xypad/xypad-disabled-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-disabled-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad component example with formatted value",
    files: [
      {
        path: "components/xypad/xypad-format-value-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-format-value-demo",
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
    categories: ["xypad"],
    description: "XYPad live value vs committed value callbacks",
    files: [
      {
        path: "components/xypad/xypad-change-vs-commit-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-change-vs-commit-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["xypad"],
    description: "XYPad component example with hidden value",
    files: [
      {
        path: "components/xypad/xypad-hide-value-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "xypad-hide-value-demo",
    registryDependencies: ["@audio/xypad"],
    type: "registry:example",
  },
  {
    categories: ["waveform"],
    description:
      "A seekable waveform player driven by a user-uploaded audio file — pick a file to decode its real PCM samples into a bar-chart waveform, then switch tabs to compare a plain recolored bar chart against an AudioScrubber-style playhead and handle",
    files: [
      {
        path: "components/waveform/block-waveform-player.tsx",
        type: "registry:block",
      },
    ],
    name: "block-waveform-player",
    registryDependencies: [
      "@audio/waveform",
      "@audio/waveform-path",
      "@shadcn/button",
      "@shadcn/button-group",
      "@shadcn/empty",
      "@shadcn/tabs",
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
    registryDependencies: ["@audio/waveform", "@audio/waveform-path"],
    type: "registry:example",
  },
  {
    categories: ["waveform"],
    description: "Waveform with a playhead line and handle",
    files: [
      {
        path: "components/waveform/waveform-playhead-demo.tsx",
        type: "registry:example",
      },
    ],
    name: "waveform-playhead-demo",
    registryDependencies: ["@audio/waveform", "@audio/waveform-path"],
    type: "registry:example",
  },
];
