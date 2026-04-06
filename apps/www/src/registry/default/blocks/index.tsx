import type React from "react";
import BlockAtmosMorphPad from "./block-atmos-morph-pad";
import BlockFilterPad from "./block-filter-pad";
import BlockLevelKnob from "./block-level-knob";
import BlockMacroKnob from "./block-macro-knob";
import BlockPanKnob from "./block-pan-knob";
import BlockPanWidthControls from "./block-pan-width-controls";
import BlockPlayer from "./block-player";
import BlockPlayerWidget from "./block-player-widget";
import BlockPocketSynth from "./block-pocket-synth";
import BlockQueue from "./block-queue";
import BlockTrackList from "./block-track-list";
import BlockTrackListGrid from "./block-track-list-grid";
import BlockTrackSortableList from "./block-track-sortable-list";
import BlockTrackSortableListGrid from "./block-track-sortable-list-grid";
import BlockTransport from "./block-transport";
import BlockVolumeInline from "./block-volume-inline";
import BlockVolumeSlider from "./block-volume-slider";
import BlockVolumeStrip from "./block-volume-strip";
import BlockWaveShaper from "./block-wave-shaper";

type BlockComponent = React.ComponentType;

type BlockItem = {
  id: string;
  component: BlockComponent;
  fullWidth?: boolean;
  className?: string;
  category?: string[];
};

export const blocks: BlockItem[] = [
  {
    id: "block-player",
    component: BlockPlayer,
    category: ["player"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-player-widget",
    component: BlockPlayerWidget,
    category: ["player", "track"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-queue",
    component: BlockQueue,
    category: ["player", "queue"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "track-list-demo",
    component: BlockTrackList,
    category: ["track"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "track-list-grid-demo",
    component: BlockTrackListGrid,
    category: ["track", "grid"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "track-sortable-list-demo",
    component: BlockTrackSortableList,
    category: ["track", "sortable"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "track-sortable-list-grid-demo",
    component: BlockTrackSortableListGrid,
    category: ["track", "sortable", "grid"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-level-knob",
    component: BlockLevelKnob,
    category: ["ui", "knob"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-macro-knob",
    component: BlockMacroKnob,
    category: ["ui", "knob"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-volume-slider",
    component: BlockVolumeSlider,
    category: ["ui", "fader"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-volume-inline",
    component: BlockVolumeInline,
    category: ["ui", "fader"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-volume-strip",
    component: BlockVolumeStrip,
    category: ["ui", "fader"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-filter-pad",
    component: BlockFilterPad,
    category: ["ui", "xypad"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-atmos-morph-pad",
    component: BlockAtmosMorphPad,
    category: ["ui", "xypad"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-transport",
    component: BlockTransport,
    category: ["ui", "transport"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-pan-knob",
    component: BlockPanKnob,
    category: ["ui", "knob"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-pan-width-controls",
    component: BlockPanWidthControls,
    category: ["ui", "knob"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-pocket-synth",
    component: BlockPocketSynth,
    category: ["synth", "xypad"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-wave-shaper",
    component: BlockWaveShaper,
    category: ["synth", "xypad"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
];
