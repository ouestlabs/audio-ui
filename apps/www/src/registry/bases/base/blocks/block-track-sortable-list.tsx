"use client";

import { toast } from "sonner";
import { useAudioStore } from "@/registry/bases/base/lib/audio-store";
import { AudioTrackList } from "@/registry/bases/base/ui/audio/player";

export default function BlockTrackSortableList() {
  const queue = useAudioStore((state) => state.queue);

  return (
    <AudioTrackList
      className="w-full"
      mode="sortable"
      onTrackSelect={(index) => {
        const track = queue[index];
        toast.info(`Playing: ${track?.title}`);
      }}
    />
  );
}
