import {
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
  demoTracks,
} from "@/components/player";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <AudioPlayer
        className="w-[420px] rounded-2xl border p-2"
        tracks={demoTracks}
      >
        <AudioPlayerControlBar>
          <AudioPlayerControlGroup>
            <AudioPlayerSkipBack />
            <AudioPlayerRewind />
            <AudioPlayerPlay />
            <AudioPlayerFastForward />
            <AudioPlayerSkipForward />
          </AudioPlayerControlGroup>
          <AudioPlayerVolume />
        </AudioPlayerControlBar>
        <AudioPlayerControlBar>
          <AudioPlayerTimeDisplay />
          <AudioPlayerSeekBar />
          <AudioPlayerTimeDisplay remaining />
        </AudioPlayerControlBar>
      </AudioPlayer>
    </div>
  );
}
