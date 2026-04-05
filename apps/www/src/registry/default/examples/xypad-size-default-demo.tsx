import { XYPad } from "@/registry/default/ui/audio/elements/xypad";

export default function XYPadSizeDefaultDemo() {
  return (
    <XYPad
      className="aspect-square"
      defaultValue={{ x: 40, y: 65 }}
      size="default"
    />
  );
}
