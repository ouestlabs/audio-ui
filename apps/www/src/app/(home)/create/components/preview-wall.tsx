import type { ComponentType } from "react";
import BlockChannelStripKnobMulti from "@/registry/default/blocks/block-channel-strip-knob-multi";
import BlockChannelStripTransport from "@/registry/default/blocks/block-channel-strip-transport";
import BlockPlayer from "@/registry/default/blocks/block-player";
import BlockPlayerWidget from "@/registry/default/blocks/block-player-widget";
import BlockPocketSynth from "@/registry/default/blocks/block-pocket-synth";
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
    ],
  },
  {
    key: "b",
    cards: [
      { id: "player-widget", Component: BlockPlayerWidget },
      { id: "track-sortable-grid", Component: BlockTrackSortableListGrid },
      { id: "transport", Component: BlockChannelStripTransport },
    ],
  },
  {
    key: "c",
    cards: [
      { id: "wave-shaper", Component: BlockWaveShaper },
      { id: "player", Component: BlockPlayer },
    ],
  },
];

export function PreviewWall() {
  return (
    <div className="flex items-start gap-4">
      {COLUMNS.map((column) => (
        <div
          className="flex shrink-0 flex-col gap-4 py-4 first:pl-4 last:pr-4"
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
