import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";

export default function FaderSizeVariantsDemo() {
  return (
    <div className="flex items-end gap-6">
      <div className="flex h-max flex-col items-center gap-2">
        <Fader defaultValue={38} max={100} min={0} size="sm" step={1} />
        <p className="text-muted-foreground text-xs">sm</p>
      </div>

      <div className="flex h-max flex-col items-center gap-2">
        <Fader defaultValue={50} max={100} min={0} size="default" step={1} />
        <p className="text-muted-foreground text-xs">default</p>
      </div>

      <div className="flex h-max flex-col items-center gap-2">
        <Fader defaultValue={62} max={100} min={0} size="lg" step={1} />
        <p className="text-muted-foreground text-xs">lg</p>
      </div>
    </div>
  );
}
