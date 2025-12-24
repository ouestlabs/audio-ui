import { Knob } from "@/registry/default/ui/audio/elements/knob";

export default function KnobDemo() {
  return <Knob defaultValue={50} max={100} min={0} step={1} />;
}
