"use client";

import {
  AudioPlaybackSpeed,
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
  AudioPlayerFastForward,
  AudioPlayerPlay,
  AudioPlayerRewind,
  AudioPlayerSeekBar,
  AudioPlayerSkipBack,
  AudioPlayerSkipForward,
  AudioPlayerTimeDisplay,
  AudioPlayerVolume,
  AudioQueue,
  AudioQueuePreferences,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
  AudioTrackList,
  demoTracks,
} from "@/components/player";

export default function Player() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8">
      <p className="text-muted-foreground text-xs">
        registry · @audio/player · full composite
      </p>
      <AudioPlayer className="p-2" tracks={demoTracks}>
        <AudioPlayerControlBar>
          <AudioPlayerControlGroup>
            <AudioQueueShuffle />
            <AudioPlayerSkipBack />
            <AudioPlayerRewind />
            <AudioPlayerPlay />
            <AudioPlayerFastForward />
            <AudioPlayerSkipForward />
            <AudioQueueRepeatMode />
          </AudioPlayerControlGroup>
          <AudioPlayerControlGroup>
            <AudioPlayerVolume />
            <AudioPlaybackSpeed />
            <AudioQueuePreferences />
            <AudioQueue />
          </AudioPlayerControlGroup>
        </AudioPlayerControlBar>
        <AudioPlayerControlBar>
          <AudioPlayerTimeDisplay />
          <AudioPlayerSeekBar />
          <AudioPlayerTimeDisplay remaining />
        </AudioPlayerControlBar>
        <AudioTrackList />
      </AudioPlayer>
    </div>
  );
}
