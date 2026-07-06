"use client";

import {
  AudioPlaybackSpeed,
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
  AudioPlayerPlay,
  AudioPlayerSkipBack,
  AudioPlayerSkipForward,
} from "@/registry-audio/bases/base/audio/player";

export default function AudioPlaybackSpeedDemo() {
  return (
    <AudioPlayer className="w-fit">
      <AudioPlayerControlBar>
        <AudioPlayerControlGroup className="w-auto">
          <AudioPlayerSkipBack />
          <AudioPlayerPlay />
          <AudioPlayerSkipForward />
          <AudioPlaybackSpeed />
        </AudioPlayerControlGroup>
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
