"use client";

import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

export default function KnobVerticalDragDemo() {
  return (
    <Knob
      aria-label="Level"
      defaultValue={50}
      dragMode="vertical"
      max={100}
      min={0}
      size="lg"
      step={1}
    />
  );
}
