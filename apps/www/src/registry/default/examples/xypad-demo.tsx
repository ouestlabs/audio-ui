import { XYPad } from "@/registry/default/ui/audio/elements/xypad";

export default function XypadDemo() {
  return <XYPad className="aspect-square" defaultValue={{ x: 50, y: 50 }} />;
}
