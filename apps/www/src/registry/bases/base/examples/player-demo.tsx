import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerPlay,
  AudioPlayerSeekBar,
  AudioPlayerTimeDisplay,
  AudioPlayerVolume,
} from "@/registry/bases/base/ui/audio/player";

export default function AudioDemoPlayer() {
  return (
    <AudioPlayer>
      <AudioPlayerControlBar>
        <AudioPlayerPlay />
        <AudioPlayerSeekBar />
        <AudioPlayerTimeDisplay />
        <AudioPlayerVolume />
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
