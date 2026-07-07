"use client";
import { toast } from "sonner";
import { AudioTrackList } from "@/registry-audio/bases/base/audio/player";
import { useAudioStore } from "@/registry-audio/bases/base/lib/audio-store";

export default function AudioTrackListDemo() {
  const queue = useAudioStore((state) => state.queue);

  return (
    <AudioTrackList
      className="w-full"
      onTrackSelect={(index) => {
        const track = queue[index];
        toast.info(`Playing: ${track?.title}`);
      }}
    />
  );
}
