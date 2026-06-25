import type { ComponentType } from "react";
import BlockChannelStripFaderMulti from "@/registry/bases/base/blocks/block-channel-strip-fader-multi";
import BlockChannelStripHorizontal from "@/registry/bases/base/blocks/block-channel-strip-horizontal";
import BlockChannelStripKnobMulti from "@/registry/bases/base/blocks/block-channel-strip-knob-multi";
import BlockChannelStripKnobPanWidth from "@/registry/bases/base/blocks/block-channel-strip-knob-pan-width";
import BlockChannelStripXypadFilter from "@/registry/bases/base/blocks/block-channel-strip-xypad-filter";
import BlockChannelStripXypadReverb from "@/registry/bases/base/blocks/block-channel-strip-xypad-reverb";
import BlockPlayer from "@/registry/bases/base/blocks/block-player";
import BlockPlayerWidget from "@/registry/bases/base/blocks/block-player-widget";
import BlockPocketSynth from "@/registry/bases/base/blocks/block-pocket-synth";
import BlockWaveShaper from "@/registry/bases/base/blocks/block-wave-shaper";

type Card = { id: string; Component: ComponentType };

const COLUMNS: { key: string; cards: Card[] }[] = [
  {
    key: "a",
    cards: [
      { id: "pocket-synth", Component: BlockPocketSynth },
      { id: "player-widget", Component: BlockPlayerWidget },
      { id: "fader-multi", Component: BlockChannelStripFaderMulti },
    ],
  },
  {
    key: "b",
    cards: [
      { id: "wave-shaper", Component: BlockWaveShaper },
      { id: "player", Component: BlockPlayer },
      { id: "knob-multi", Component: BlockChannelStripKnobMulti },
      {
        id: "channel-strip-horizontal",
        Component: BlockChannelStripHorizontal,
      },
    ],
  },
  {
    key: "c",
    cards: [
      { id: "knob-pan-width", Component: BlockChannelStripKnobPanWidth },
      { id: "xypad-filter", Component: BlockChannelStripXypadFilter },
      { id: "xypad-reverb", Component: BlockChannelStripXypadReverb },
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
