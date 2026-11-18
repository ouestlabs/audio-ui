import { useState } from "react";
import {
  type FrequencyShifterState,
  frequencyShifterDevice,
} from "@/registry/bases/base/devices/frequency-shifter/device";
import { createFrequencyShifterEngine } from "@/registry/bases/base/devices/frequency-shifter/engine";
import { FrequencyShifterPanel } from "@/registry/bases/base/devices/frequency-shifter/panel";
import { useDeviceLoop } from "@/registry/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A frequency shifter you can plug in: its state, a panel that draws what it
 * does to a note and its harmonics and an engine that plays it, each its own
 * file and none knowing the others. Play the loop and turn the shift.
 */
export default function BlockFrequencyShifter() {
  const [state, setState] = useState<FrequencyShifterState>(() =>
    frequencyShifterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createFrequencyShifterEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, frequencyShifterDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <FrequencyShifterPanel
        onValueChange={setState}
        signal={signal}
        value={state}
      />
    </div>
  );
}
