import { Meter } from "@/registry/bases/shared/audio-ui/elements/meter";
import { useSimulatedLevels } from "@/registry/bases/shared/hooks/use-simulated-levels";

// The marks of a dBFS scale, down to the floor.
const SCALE = [6, 0, -6, -12, -20, -30, -40, -60];

export default function MeterNeuDemo() {
  const source = useSimulatedLevels(2);
  return (
    <div className="skin-neu audio-body rounded-2xl px-10 py-8">
      <Meter
        aria-label="Stereo output"
        marks={SCALE}
        source={source}
        warnThreshold={-12}
      />
    </div>
  );
}
