"use client";

import { useState } from "react";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";

export default function TransportDemo() {
  const [value, setValue] = useState(42);

  return (
    <Transport
      aria-label="Playback position"
      bufferedValue={78}
      onSeek={setValue}
      value={value}
    />
  );
}
