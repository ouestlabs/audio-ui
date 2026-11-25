import { HardwareVuMeter } from "@/registry/bases/shared/audio-ui/skins/hardware/vu-meter";
import { useSimulatedLevels } from "@/registry/bases/shared/hooks/use-simulated-levels";

export default function MeterHardwareDemo() {
  // 0 VU is -18 dB: the levels stay where the dial is.
  const source = useSimulatedLevels(2, { max: -15, min: -33 });
  return (
    <div className="skin-hardware audio-body rounded-xl p-4">
      <HardwareVuMeter aria-label="Stereo output" source={source} />
    </div>
  );
}
