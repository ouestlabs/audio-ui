import { Fader } from "@/registry/bases/shared/audio-ui/elements/fader";

export default function FaderNeuDemo() {
  return (
    <div className="skin-neu audio-body flex h-64 gap-10 rounded-2xl px-10 py-8">
      <Fader
        aria-label="Volume"
        defaultValue={-6}
        editableValue
        max={6}
        min={-60}
        step={0.5}
      />
      <Fader aria-label="Send" defaultValue={-24} max={6} min={-60} />
    </div>
  );
}
