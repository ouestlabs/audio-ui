import { XYPad } from "@/registry/bases/base/ui/audio/elements/xypad";

export default function XYPadDisabledDemo() {
  return (
    <XYPad className="aspect-square" defaultValue={{ x: 50, y: 50 }} disabled />
  );
}
