"use client";

import { Transport } from "@/registry/default/ui/audio/elements/transport";

export default function BlockTransport() {
  return (
    <div className="w-full rounded-xl border bg-card p-4">
      <Transport
        aria-label="Seek"
        bufferedValue={62}
        onSeek={() => {
          //
        }}
        value={35}
      />
    </div>
  );
}
