import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function FaderNoThumbMarksDemo() {
  return (
    <div className="h-max">
      <Fader defaultValue={50} max={100} min={0} step={1} thumbMarks={false} />
    </div>
  );
}
