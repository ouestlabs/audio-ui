"use client";

import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
  AudioPlayerPlay,
  AudioPlayerSeekBar,
  AudioPlayerSkipBack,
  AudioPlayerSkipForward,
  AudioPlayerTimeDisplay,
  AudioPlayerVolume,
  AudioQueue,
  AudioQueuePreferences,
} from "@/registry/default/ui/audio/player";

export default function AudioQueueSimpleDemo() {
  return (
    <AudioPlayer>
      <AudioPlayerControlBar variant="stacked">
        <AudioPlayerControlGroup>
          <AudioPlayerTimeDisplay />
          <AudioPlayerSeekBar />
          <AudioPlayerTimeDisplay remaining />
        </AudioPlayerControlGroup>
        <AudioPlayerControlGroup className="justify-between">
          <AudioPlayerControlGroup>
            <AudioPlayerSkipBack />
            <AudioPlayerPlay />
            <AudioPlayerSkipForward />
          </AudioPlayerControlGroup>
          <AudioPlayerControlGroup className="flex-1">
            <AudioPlayerVolume />
            <AudioQueuePreferences />
            <AudioQueue />
          </AudioPlayerControlGroup>
        </AudioPlayerControlGroup>
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
