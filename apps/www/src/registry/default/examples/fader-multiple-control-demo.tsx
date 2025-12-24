import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function FaderMultipleControlDemo() {
  return (
    <section className="flex gap-5">
      {Array.from(["CH1", "CH2", "CH3"]).map((channel) => (
        <div className="flex h-max flex-col items-center gap-2" key={channel}>
          <Fader defaultValue={50} max={100} min={0} step={1} />
          <output className="text-xs">{channel}</output>
        </div>
      ))}
    </section>
  );
}
