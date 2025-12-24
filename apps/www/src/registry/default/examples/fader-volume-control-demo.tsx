"use client";
import { useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function FaderVolumeControlDemo() {
  const [volume, setVolume] = useState(50);

  return (
    <div className="flex h-max flex-col items-center gap-3">
      <Fader
        max={100}
        min={0}
        onValueChange={setVolume}
        orientation="vertical"
        step={1}
        value={volume}
      />
      <output className="text-sm">{volume}%</output>
    </div>
  );
}
