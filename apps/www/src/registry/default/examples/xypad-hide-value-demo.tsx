"use client";
import { XYPad } from "@/registry/default/ui/audio/elements/xypad";

export default function XypadHideValueDemo() {
  return (
    <XYPad
      className="aspect-square"
      defaultValue={{ x: 50, y: 50 }}
      maxX={100}
      maxY={100}
      minX={0}
      minY={0}
      showValueDisplay={false}
    />
  );
}
