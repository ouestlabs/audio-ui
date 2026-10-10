import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";

export default function XYPadSizeXlDemo() {
  return (
    <XYPad
      aria-label="Extra large pad"
      className="aspect-square"
      defaultValue={{ x: 40, y: 65 }}
      size="xl"
    />
  );
}
