"use client";
import { XYPad } from "@/registry/default/ui/audio/elements/xypad";

export default function XypadSynthesizerControlDemo() {
  return (
    <XYPad
      className="aspect-square"
      defaultValue={{ x: 50, y: 50 }}
      formatValue={(val) => {
        const freq = Math.round(20 + (val.x / 100) * 20_000);
        const cutoff = Math.round(200 + (val.y / 100) * 8000);
        return `${freq}Hz, ${cutoff}Hz`;
      }}
      maxX={100}
      maxY={100}
      minX={0}
      minY={0}
    />
  );
}
