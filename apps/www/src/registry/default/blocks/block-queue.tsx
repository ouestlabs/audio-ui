"use client";

import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
} from "@/registry/default/ui/audio/player";
import {
  AudioQueue,
  AudioQueuePreferences,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
} from "@/registry/default/ui/audio/queue";

export default function BlockQueue() {
  return (
    <AudioPlayer>
      <AudioPlayerControlBar>
        <AudioPlayerControlGroup className="justify-end">
          <AudioQueueShuffle />
          <AudioQueueRepeatMode />
          <AudioQueuePreferences />
          <AudioQueue />
        </AudioPlayerControlGroup>
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
