import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerPlay,
  AudioPlayerSeekBar,
  AudioPlayerTimeDisplay,
  AudioPlayerVolume,
} from "@/registry-audio/bases/base/audio/player";

export default function AudioPlayerSizeDemo() {
  const controls = (
    <AudioPlayerControlBar>
      <AudioPlayerPlay />
      <AudioPlayerSeekBar />
      <AudioPlayerTimeDisplay />
      <AudioPlayerVolume />
    </AudioPlayerControlBar>
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <AudioPlayer size="sm">{controls}</AudioPlayer>
        <p className="text-center text-muted-foreground text-xs">sm</p>
      </div>
      <div className="flex flex-col gap-2">
        <AudioPlayer size="default">{controls}</AudioPlayer>
        <p className="text-center text-muted-foreground text-xs">default</p>
      </div>
    </div>
  );
}
