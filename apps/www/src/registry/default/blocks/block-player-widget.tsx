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
  AudioQueueRepeatMode,
  AudioQueueShuffle,
  AudioTrackList,
} from "@/registry/default/ui/audio/player";

export default function BlockPlayerWidget() {
  return (
    <AudioPlayer className="flex flex-col gap-4">
      <AudioTrackList className="h-40 w-full rounded-2xl border p-1" />
      <AudioPlayerControlBar variant="stacked">
        <AudioPlayerControlGroup>
          <AudioPlayerTimeDisplay />
          <AudioPlayerSeekBar />
          <AudioPlayerTimeDisplay remaining />
        </AudioPlayerControlGroup>
        <AudioPlayerControlGroup>
          <AudioPlayerControlGroup>
            <AudioPlayerSkipBack />
            <AudioPlayerPlay />
            <AudioPlayerSkipForward />
          </AudioPlayerControlGroup>
          <AudioQueueShuffle />
          <AudioQueueRepeatMode />
          <AudioPlayerVolume />
        </AudioPlayerControlGroup>
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
