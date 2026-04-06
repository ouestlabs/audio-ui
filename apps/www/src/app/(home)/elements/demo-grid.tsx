import BlockPlayerWidget from "@/registry/default/blocks/block-player-widget";
import BlockPocketSynth from "@/registry/default/blocks/block-pocket-synth";
import BlockGranularSynth from "@/registry/default/blocks/block-wave-shaper";
import PlayerDemo from "@/registry/default/examples/player-demo";
import PlayerQueueDemo from "@/registry/default/examples/player-queue-demo";
import AudioTrackListGridDemo from "@/registry/default/examples/track-list-grid-demo";
import AudioTrackSortableListGridDemo from "@/registry/default/examples/track-sortable-list-grid-demo";

export function DemoGrid() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-3">
        <BlockPocketSynth />
        <BlockPlayerWidget />
        <AudioTrackListGridDemo />
      </div>
      <div className="space-y-3">
        <PlayerQueueDemo />
        <BlockGranularSynth />
        <AudioTrackSortableListGridDemo />
        <PlayerDemo />
      </div>
    </div>
  );
}
