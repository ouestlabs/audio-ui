import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioQueue,
  AudioQueuePreferences,
} from "@/registry/bases/base/ui/audio/player";

export default function AudioQueuePreferencesDemo() {
  return (
    <AudioPlayer className="w-max">
      <AudioPlayerControlBar>
        <AudioQueuePreferences />
        <AudioQueue />
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
