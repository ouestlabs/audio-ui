import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioQueue,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
} from "@/registry-audio/bases/base/audio/player";

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
