"use client";
import { toast } from "sonner";
import { AudioTrackList } from "@/registry-audio/bases/base/audio/player";
import { useQueueState } from "@/registry-audio/bases/base/hooks/use-audio-session";

export default function AudioTrackListDemo() {
  const { queue } = useQueueState();

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
