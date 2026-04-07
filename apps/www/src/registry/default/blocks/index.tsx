import type React from "react";
import BlockChannelStrip from "./block-channel-strip";
import BlockChannelStripFader from "./block-channel-strip-fader";
import BlockChannelStripFaderGainDb from "./block-channel-strip-fader-gain-db";
import BlockChannelStripFaderHorizontal from "./block-channel-strip-fader-horizontal";
import BlockChannelStripFaderMulti from "./block-channel-strip-fader-multi";
import BlockChannelStripFaderSlider from "./block-channel-strip-fader-slider";
import BlockChannelStripHorizontal from "./block-channel-strip-horizontal";
import BlockChannelStripKnobLevel from "./block-channel-strip-knob-level";
import BlockChannelStripKnobMacro from "./block-channel-strip-knob-macro";
import BlockChannelStripKnobMulti from "./block-channel-strip-knob-multi";
import BlockChannelStripKnobPan from "./block-channel-strip-knob-pan";
import BlockChannelStripKnobPanWidth from "./block-channel-strip-knob-pan-width";
import BlockChannelStripTransport from "./block-channel-strip-transport";
import BlockChannelStripTransportVertical from "./block-channel-strip-transport-vertical";
import BlockChannelStripXypadFilter from "./block-channel-strip-xypad-filter";
import BlockChannelStripXypadReverb from "./block-channel-strip-xypad-reverb";
import BlockPlayer from "./block-player";
import BlockPlayerWidget from "./block-player-widget";
import BlockPocketSynth from "./block-pocket-synth";
import BlockQueue from "./block-queue";
import BlockTrackList from "./block-track-list";
import BlockTrackListGrid from "./block-track-list-grid";
import BlockTrackSortableList from "./block-track-sortable-list";
import BlockTrackSortableListGrid from "./block-track-sortable-list-grid";
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
    id: "block-track-list",
    component: BlockTrackList,
    category: ["track"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-track-list-grid",
    component: BlockTrackListGrid,
    category: ["track"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-track-sortable-list",
    component: BlockTrackSortableList,
    category: ["track"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-track-sortable-list-grid",
    component: BlockTrackSortableListGrid,
    category: ["track"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-channel-strip",
    component: BlockChannelStrip,
    category: ["channel-strip", "fader"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-horizontal",
    component: BlockChannelStripHorizontal,
    category: ["channel-strip", "fader"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-channel-strip-fader",
    component: BlockChannelStripFader,
    category: ["channel-strip", "fader"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-fader-gain-db",
    component: BlockChannelStripFaderGainDb,
    category: ["channel-strip", "fader"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-fader-multi",
    component: BlockChannelStripFaderMulti,
    category: ["channel-strip", "fader"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-channel-strip-knob-multi",
    component: BlockChannelStripKnobMulti,
    category: ["channel-strip", "knob"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-channel-strip-fader-horizontal",
    component: BlockChannelStripFaderHorizontal,
    category: ["channel-strip", "fader"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-channel-strip-fader-slider",
    component: BlockChannelStripFaderSlider,
    category: ["channel-strip", "fader"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-channel-strip-knob-level",
    component: BlockChannelStripKnobLevel,
    category: ["channel-strip", "knob"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-knob-macro",
    component: BlockChannelStripKnobMacro,
    category: ["channel-strip", "knob"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-knob-pan",
    component: BlockChannelStripKnobPan,
    category: ["channel-strip", "knob"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-knob-pan-width",
    component: BlockChannelStripKnobPanWidth,
    category: ["channel-strip", "knob"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-xypad-filter",
    component: BlockChannelStripXypadFilter,
    category: ["channel-strip", "xypad"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-xypad-reverb",
    component: BlockChannelStripXypadReverb,
    category: ["channel-strip", "xypad"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-channel-strip-transport",
    component: BlockChannelStripTransport,
    category: ["channel-strip", "transport"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-channel-strip-transport-vertical",
    component: BlockChannelStripTransportVertical,
    category: ["channel-strip", "transport"],
    className: "**:data-[slot=block-wrapper]:w-max",
  },
  {
    id: "block-pocket-synth",
    component: BlockPocketSynth,
    category: ["channel-strip", "synth", "xypad"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
  {
    id: "block-wave-shaper",
    component: BlockWaveShaper,
    category: ["channel-strip", "synth", "xypad"],
    className: "**:data-[slot=block-wrapper]:w-full",
  },
];
