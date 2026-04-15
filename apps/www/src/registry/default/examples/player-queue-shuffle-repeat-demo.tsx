import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioQueue,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
} from "@/registry/default/ui/audio/player";

export default function AudioQueueShuffleRepeatDemo() {
  return (
    <AudioPlayer className="w-max">
      <AudioPlayerControlBar>
        <AudioQueueShuffle />
        <AudioQueueRepeatMode />
        <AudioQueue />
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
