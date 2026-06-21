import type { ComponentType } from "react";
import BlockChannelStripFader from "@/registry/default/blocks/block-channel-strip-fader";
import BlockChannelStripFaderGainDb from "@/registry/default/blocks/block-channel-strip-fader-gain-db";
import BlockChannelStripFaderHorizontal from "@/registry/default/blocks/block-channel-strip-fader-horizontal";
import BlockChannelStripFaderMulti from "@/registry/default/blocks/block-channel-strip-fader-multi";
import BlockChannelStripFaderSlider from "@/registry/default/blocks/block-channel-strip-fader-slider";
import BlockChannelStripKnobLevel from "@/registry/default/blocks/block-channel-strip-knob-level";
import BlockChannelStripKnobMacro from "@/registry/default/blocks/block-channel-strip-knob-macro";
import BlockChannelStripKnobMulti from "@/registry/default/blocks/block-channel-strip-knob-multi";
import BlockChannelStripKnobPan from "@/registry/default/blocks/block-channel-strip-knob-pan";
import BlockChannelStripKnobPanWidth from "@/registry/default/blocks/block-channel-strip-knob-pan-width";
import BlockChannelStripTransport from "@/registry/default/blocks/block-channel-strip-transport";
import BlockChannelStripTransportVertical from "@/registry/default/blocks/block-channel-strip-transport-vertical";
import BlockChannelStripXypadFilter from "@/registry/default/blocks/block-channel-strip-xypad-filter";
import BlockChannelStripXypadReverb from "@/registry/default/blocks/block-channel-strip-xypad-reverb";
import BlockPlayerWidget from "@/registry/default/blocks/block-player-widget";
import BlockPocketSynth from "@/registry/default/blocks/block-pocket-synth";
import BlockQueue from "@/registry/default/blocks/block-queue";
import BlockTrackList from "@/registry/default/blocks/block-track-list";
import BlockTrackListGrid from "@/registry/default/blocks/block-track-list-grid";
import BlockWaveShaper from "@/registry/default/blocks/block-wave-shaper";

type Card = { id: string; Component: ComponentType };

// Each column mixes one tall card (synth / xy-pad / player) with shorter ones
// so column heights stay roughly even — a dense, aligned bento wall.
const COLUMNS: Card[][] = [
  [
    { id: "pocket-synth", Component: BlockPocketSynth },
    { id: "knob-pan", Component: BlockChannelStripKnobPan },
    { id: "fader-multi", Component: BlockChannelStripFaderMulti },
    { id: "transport", Component: BlockChannelStripTransport },
  ],
  [
    { id: "xypad-filter", Component: BlockChannelStripXypadFilter },
    { id: "knob-multi", Component: BlockChannelStripKnobMulti },
    { id: "fader-gain-db", Component: BlockChannelStripFaderGainDb },
    { id: "track-list", Component: BlockTrackList },
  ],
  [
    { id: "player-widget", Component: BlockPlayerWidget },
    { id: "knob-level", Component: BlockChannelStripKnobLevel },
    { id: "fader", Component: BlockChannelStripFader },
    { id: "queue", Component: BlockQueue },
  ],
  [
    { id: "wave-shaper", Component: BlockWaveShaper },
    { id: "knob-macro", Component: BlockChannelStripKnobMacro },
    { id: "fader-slider", Component: BlockChannelStripFaderSlider },
    { id: "transport-vertical", Component: BlockChannelStripTransportVertical },
  ],
  [
    { id: "xypad-reverb", Component: BlockChannelStripXypadReverb },
    { id: "knob-pan-width", Component: BlockChannelStripKnobPanWidth },
    { id: "fader-horizontal", Component: BlockChannelStripFaderHorizontal },
    { id: "track-list-grid", Component: BlockTrackListGrid },
  ],
];

export function PreviewWall() {
  return (
    <div className="flex h-max items-start gap-(--gap)">
      {COLUMNS.map((column) => (
        <div
          className="flex w-88 shrink-0 flex-col gap-(--gap)"
          key={column[0].id}
        >
          {column.map(({ id, Component }) => (
            <Component key={id} />
          ))}
        </div>
      ))}
    </div>
  );
}
