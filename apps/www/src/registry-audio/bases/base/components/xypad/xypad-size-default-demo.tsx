import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";

export default function XYPadSizeDefaultDemo() {
  return (
    <XYPad
      className="aspect-square"
      defaultValue={{ x: 40, y: 65 }}
      size="default"
    />
  );
}
