"use client";
import { toast } from "sonner";
import { AudioTrackList } from "@/registry-audio/bases/base/audio/player";
import { useQueueState } from "@/registry-audio/bases/base/lib/audio-store";

export default function AudioTrackSortableListGridDemo() {
  const { queue } = useQueueState();

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
