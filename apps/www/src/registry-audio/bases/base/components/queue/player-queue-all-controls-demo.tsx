import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioQueue,
  AudioQueuePreferences,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
} from "@/registry-audio/bases/base/audio/player";

export default function AudioQueueAllControlsDemo() {
  return (
    <AudioPlayer className="w-max">
      <AudioPlayerControlBar>
        <AudioQueueShuffle />
        <AudioQueueRepeatMode />
        <AudioQueuePreferences />
        <AudioQueue />
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
