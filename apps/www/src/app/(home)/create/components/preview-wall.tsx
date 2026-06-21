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

// Hand-balanced columns: even heights, no gaps. The player widget sits directly
// under the channel-strip filter (column B), per design.
const COLUMNS: { key: string; cards: Card[] }[] = [
  {
    key: "a",
    cards: [
      { id: "pocket-synth", Component: BlockPocketSynth },
      { id: "knob-multi", Component: BlockChannelStripKnobMulti },
      { id: "track-list", Component: BlockTrackList },
      { id: "track-sortable-list", Component: BlockTrackSortableList },
    ],
  },
  {
    key: "b",
    cards: [
      { id: "xypad-filter", Component: BlockChannelStripXypadFilter },
      { id: "player-widget", Component: BlockPlayerWidget },
      { id: "queue", Component: BlockQueue },
      { id: "track-list-grid", Component: BlockTrackListGrid },
    ],
  },
  {
    key: "c",
    cards: [
      { id: "wave-shaper", Component: BlockWaveShaper },
      { id: "xypad-reverb", Component: BlockChannelStripXypadReverb },
      { id: "player", Component: BlockPlayer },
      { id: "track-sortable-grid", Component: BlockTrackSortableListGrid },
    ],
  },
];

export function PreviewWall() {
  return (
    <div className="flex items-start gap-(--gap)">
      {COLUMNS.map((column) => (
        <div
          className="flex w-fit shrink-0 flex-col gap-(--gap)"
          key={column.key}
        >
          {column.cards.map(({ id, Component }) => (
            <Component key={id} />
          ))}
        </div>
      ))}
    </div>
  );
}
