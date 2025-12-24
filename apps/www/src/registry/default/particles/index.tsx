import type React from "react";
import AudioQueueSimpleDemo from "../examples/queue-simple-demo";
import AudioTrackListDemo from "../examples/track-list-demo";
import AudioTrackListGridDemo from "../examples/track-list-grid-demo";
import AudioTrackSortableListDemo from "../examples/track-sortable-list-demo";
import AudioTrackSortableListGridDemo from "../examples/track-sortable-list-grid-demo";
import ParticleAudioPlayer from "./particle-player";
import ParticlePlayerWidget from "./particle-player-widget";
import ParticlePocketSynth from "./particle-pocket-synth";
import ParticleWaveShaper from "./particle-wave-shaper";

type ParticleComponent = React.ComponentType;

type ParticleItem = {
  id: string;
  component: ParticleComponent;
  fullWidth?: boolean;
  className?: string;
  category?: string[];
};

export const particles: ParticleItem[] = [
  {
    id: "particle-player",
    component: ParticleAudioPlayer,
    category: ["player"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },
  {
    id: "particle-player-widget",
    component: ParticlePlayerWidget,
    category: ["player", "track"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },
  {
    id: "queue-simple-demo",
    component: AudioQueueSimpleDemo,
    category: ["player", "queue"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },

  {
    id: "track-list-demo",
    component: AudioTrackListDemo,
    category: ["track"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },
  {
    id: "track-list-grid-demo",
    component: AudioTrackListGridDemo,
    category: ["track", "grid"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },

  {
    id: "track-sortable-list-demo",
    component: AudioTrackSortableListDemo,
    category: ["track", "sortable"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },
  {
    id: "track-sortable-list-grid-demo",
    component: AudioTrackSortableListGridDemo,
    category: ["track", "sortable", "grid"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },
  {
    id: "particle-pocket-synth",
    component: ParticlePocketSynth,
    category: ["synth"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },
  {
    id: "particle-wave-shaper",
    component: ParticleWaveShaper,
    category: ["synth"],
    className: "**:data-[slot=particle-wrapper]:w-full",
  },
];
