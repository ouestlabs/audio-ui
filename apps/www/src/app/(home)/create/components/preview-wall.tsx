import BlockChannelStripFaderMulti from "@/registry/default/blocks/block-channel-strip-fader-multi";
import BlockChannelStripKnobMulti from "@/registry/default/blocks/block-channel-strip-knob-multi";
import BlockChannelStripKnobPan from "@/registry/default/blocks/block-channel-strip-knob-pan";
import BlockChannelStripTransport from "@/registry/default/blocks/block-channel-strip-transport";
import BlockChannelStripXypadFilter from "@/registry/default/blocks/block-channel-strip-xypad-filter";
import BlockChannelStripXypadReverb from "@/registry/default/blocks/block-channel-strip-xypad-reverb";
import BlockPlayerWidget from "@/registry/default/blocks/block-player-widget";
import BlockPocketSynth from "@/registry/default/blocks/block-pocket-synth";
import BlockQueue from "@/registry/default/blocks/block-queue";
import BlockTrackListGrid from "@/registry/default/blocks/block-track-list-grid";
import BlockWaveShaper from "@/registry/default/blocks/block-wave-shaper";

const CARDS = [
  { id: "pocket-synth", Component: BlockPocketSynth },
  { id: "xypad-filter", Component: BlockChannelStripXypadFilter },
  { id: "player-widget", Component: BlockPlayerWidget },
  { id: "knob-multi", Component: BlockChannelStripKnobMulti },
  { id: "wave-shaper", Component: BlockWaveShaper },
  { id: "fader-multi", Component: BlockChannelStripFaderMulti },
  { id: "queue", Component: BlockQueue },
  { id: "xypad-reverb", Component: BlockChannelStripXypadReverb },
  { id: "track-list-grid", Component: BlockTrackListGrid },
  { id: "transport", Component: BlockChannelStripTransport },
  { id: "knob-pan", Component: BlockChannelStripKnobPan },
] as const;

export function PreviewWall() {
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4 [&>*]:mb-3 [&>*]:break-inside-avoid">
      {CARDS.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </div>
  );
}
