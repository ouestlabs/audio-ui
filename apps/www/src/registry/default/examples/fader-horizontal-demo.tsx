import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function FaderHorizontalDemo() {
  return (
    <div className="w-max">
      <Fader
        defaultValue={50}
        max={100}
        min={0}
        orientation="horizontal"
        step={1}
      />
    </div>
  );
}
