import BlockPlayerWidget from "@/registry/bases/base/blocks/block-player-widget";
import BlockPocketSynth from "@/registry/bases/base/blocks/block-pocket-synth";
import BlockGranularSynth from "@/registry/bases/base/blocks/block-wave-shaper";
import PlayerDemo from "@/registry/bases/base/examples/player-demo";
import PlayerQueueDemo from "@/registry/bases/base/examples/player-queue-demo";
import AudioTrackListGridDemo from "@/registry/bases/base/examples/player-track-list-grid-demo";
import AudioTrackSortableListGridDemo from "@/registry/bases/base/examples/player-track-sortable-list-grid-demo";

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
