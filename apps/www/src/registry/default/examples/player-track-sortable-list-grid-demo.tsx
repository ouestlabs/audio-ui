"use client";
import { toast } from "sonner";
import { useAudioStore } from "@/registry/default/lib/audio-store";
import { AudioTrackList } from "@/registry/default/ui/audio/player";

export default function AudioTrackSortableListGridDemo() {
  const queue = useAudioStore((state) => state.queue);

  return (
    <AudioTrackList
      className="w-full"
      mode="sortable"
      onTrackSelect={(index) => {
        const track = queue[index];
        toast.info(`Playing ${track?.title}`);
      }}
      variant="grid"
    />
  );
}
