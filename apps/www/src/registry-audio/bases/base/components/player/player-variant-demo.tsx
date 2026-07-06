import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerPlay,
  AudioPlayerSeekBar,
  AudioPlayerTimeDisplay,
  AudioPlayerVolume,
} from "@/registry-audio/bases/base/audio/player";

export default function AudioPlayerVariantDemo() {
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
        <AudioPlayer variant="default">{controls}</AudioPlayer>
        <p className="text-center text-muted-foreground text-xs">default</p>
      </div>
      <div className="flex flex-col gap-2">
        <AudioPlayer variant="ghost">{controls}</AudioPlayer>
        <p className="text-center text-muted-foreground text-xs">ghost</p>
      </div>
    </div>
  );
}
