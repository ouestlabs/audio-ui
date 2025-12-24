import { Knob } from "@/registry/default/ui/audio/elements/knob";

export default function KnobMultipleControlDemo() {
  return (
    <section className="flex gap-4">
      {Array.from(["Gain", "Reverb", "Delay"]).map((effect) => (
        <div className="flex flex-col items-center gap-2" key={effect}>
          <Knob defaultValue={50} max={100} min={0} step={1} />
          <output className="text-xs">{effect}</output>
        </div>
      ))}
    </section>
  );
}
