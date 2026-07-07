"use client";

import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
  AudioQueue,
  AudioQueuePreferences,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
} from "@/registry-audio/bases/base/audio/player";

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
