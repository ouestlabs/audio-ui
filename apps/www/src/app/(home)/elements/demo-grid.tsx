import PlayerDemo from "@/registry/default/examples/player-demo";
import PlayerQueueDemo from "@/registry/default/examples/player-queue-demo";
import AudioTrackListGridDemo from "@/registry/default/examples/track-list-grid-demo";
import AudioTrackSortableListGridDemo from "@/registry/default/examples/track-sortable-list-grid-demo";
import ParticlePlayerWidget from "@/registry/default/particles/particle-player-widget";
import ParticlePocketSynth from "@/registry/default/particles/particle-pocket-synth";
import ParticleGranularSynth from "@/registry/default/particles/particle-wave-shaper";

export function DemoGrid() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-3">
        <ParticlePocketSynth />
        <ParticlePlayerWidget />
        <AudioTrackListGridDemo />
      </div>
      <div className="space-y-3">
        <PlayerQueueDemo />
        <ParticleGranularSynth />
        <AudioTrackSortableListGridDemo />
        <PlayerDemo />
      </div>
    </div>
  );
}
