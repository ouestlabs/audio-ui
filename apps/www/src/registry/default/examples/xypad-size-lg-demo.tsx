import { XYPad } from "@/registry/default/ui/audio/elements/xypad";

export default function XYPadSizeLgDemo() {
  return (
    <XYPad
      className="aspect-square"
      defaultValue={{ x: 40, y: 65 }}
      size="lg"
    />
  );
}
