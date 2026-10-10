import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";

export default function FaderThumbMarksVariantsDemo() {
  return (
    <div className="flex items-end gap-6">
      <div className="flex h-max flex-col items-center gap-2">
        <Fader
          aria-label="Fader without thumb marks"
          defaultValue={50}
          max={100}
          min={0}
          step={1}
          thumbMarks={false}
        />
        <p className="text-center text-muted-foreground text-xs">No marks</p>
      </div>

      <div className="flex h-max flex-col items-center gap-2">
        <Fader
          aria-label="Fader with 1 thumb mark"
          defaultValue={50}
          max={100}
          min={0}
          step={1}
          thumbMarks={1}
        />
        <p className="text-center text-muted-foreground text-xs">1 mark</p>
      </div>

      <div className="flex h-max flex-col items-center gap-2">
        <Fader
          aria-label="Fader with 4 thumb marks"
          defaultValue={50}
          max={100}
          min={0}
          step={1}
          thumbMarks={4}
        />
        <p className="text-center text-muted-foreground text-xs">4 marks</p>
      </div>
    </div>
  );
}
