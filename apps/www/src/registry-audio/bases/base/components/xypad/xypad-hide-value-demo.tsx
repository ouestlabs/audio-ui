"use client";
import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";

export default function XypadHideValueDemo() {
  return (
    <XYPad
      aria-label="Position"
      className="aspect-square"
      defaultValue={{ x: 50, y: 50 }}
      maxX={100}
      maxY={100}
      minX={0}
      minY={0}
      valueDisplay="hidden"
    />
  );
}
