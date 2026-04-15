import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioQueue,
  AudioQueuePreferences,
} from "@/registry/default/ui/audio/player";

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
