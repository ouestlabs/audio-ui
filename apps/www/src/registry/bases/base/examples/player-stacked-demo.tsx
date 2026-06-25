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
} from "@/registry/bases/base/ui/audio/player";

export default function AudioPlayerStackedDemo() {
  return (
    <AudioPlayer>
      <AudioPlayerControlBar variant="stacked">
        <AudioPlayerControlGroup>
          <AudioPlayerTimeDisplay />
          <AudioPlayerSeekBar />
          <AudioPlayerTimeDisplay remaining />
        </AudioPlayerControlGroup>
        <AudioPlayerControlGroup>
          <AudioPlayerControlGroup className="justify-between md:justify-start">
            <AudioPlayerSkipBack />
            <AudioPlayerPlay />
            <AudioPlayerSkipForward />
          </AudioPlayerControlGroup>
          <AudioPlayerVolume />
        </AudioPlayerControlGroup>
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
