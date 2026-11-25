import { HardwareFader } from "@/registry/bases/shared/audio-ui/skins/hardware/fader";

export default function FaderHardwareDemo() {
  return (
    <div className="skin-hardware audio-body flex h-64 gap-8 rounded-xl px-8 py-6">
      <HardwareFader
        aria-label="Volume"
        defaultValue={-6}
        editableValue
        max={6}
        min={-60}
        step={0.5}
      />
      <HardwareFader aria-label="Send" defaultValue={-24} max={6} min={-60} />
    </div>
  );
}
