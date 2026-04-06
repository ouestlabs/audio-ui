"use client";

import { AudioPlaybackSpeed } from "@/registry/default/ui/audio/playback-speed";
import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
  AudioPlayerPlay,
  AudioPlayerSkipBack,
  AudioPlayerSkipForward,
} from "@/registry/default/ui/audio/player";

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
