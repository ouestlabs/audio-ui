import type { ComponentType } from "react";
import BlockChannelStripKnobMulti from "@/registry/default/blocks/block-channel-strip-knob-multi";
import BlockChannelStripXypadFilter from "@/registry/default/blocks/block-channel-strip-xypad-filter";
import BlockChannelStripXypadReverb from "@/registry/default/blocks/block-channel-strip-xypad-reverb";
import BlockPlayer from "@/registry/default/blocks/block-player";
import BlockPlayerWidget from "@/registry/default/blocks/block-player-widget";
import BlockPocketSynth from "@/registry/default/blocks/block-pocket-synth";
import BlockQueue from "@/registry/default/blocks/block-queue";
import BlockTrackList from "@/registry/default/blocks/block-track-list";
import BlockTrackListGrid from "@/registry/default/blocks/block-track-list-grid";
import BlockTrackSortableList from "@/registry/default/blocks/block-track-sortable-list";
import BlockTrackSortableListGrid from "@/registry/default/blocks/block-track-sortable-list-grid";
import BlockWaveShaper from "@/registry/default/blocks/block-wave-shaper";

type Card = { id: string; Component: ComponentType };

// Only full-width "card" blocks (synths, xy-pads, mixer rows, players, lists)
// so every card fills its column and the masonry balancer packs them densely.
const CARDS: Card[] = [
  { id: "pocket-synth", Component: BlockPocketSynth },
  { id: "knob-multi", Component: BlockChannelStripKnobMulti },
  { id: "xypad-filter", Component: BlockChannelStripXypadFilter },
  { id: "player-widget", Component: BlockPlayerWidget },
  { id: "wave-shaper", Component: BlockWaveShaper },
  { id: "queue", Component: BlockQueue },
  { id: "xypad-reverb", Component: BlockChannelStripXypadReverb },
  { id: "track-list-grid", Component: BlockTrackListGrid },
  { id: "track-list", Component: BlockTrackList },
  { id: "player", Component: BlockPlayer },
  { id: "track-sortable-grid", Component: BlockTrackSortableListGrid },
  { id: "track-sortable-list", Component: BlockTrackSortableList },
];

export function PreviewWall() {
  return (
    <div className="h-full w-[1320px] columns-3 gap-(--gap) [&>*]:mb-(--gap) [&>*]:w-full [&>*]:break-inside-avoid">
      {CARDS.map(({ id, Component }) => (
        <div className="break-inside-avoid" key={id}>
          <Component />
        </div>
      ))}
    </div>
  );
}
