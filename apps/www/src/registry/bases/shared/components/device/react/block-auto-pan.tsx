import { useState } from "react";
import {
  type AutoPanState,
  autoPanDevice,
} from "@/registry/bases/shared/devices/auto-pan/device";
import { createAutoPanEngine } from "@/registry/bases/shared/devices/auto-pan/engine";
import { AutoPanPanel } from "@/registry/bases/shared/devices/auto-pan/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;
/** Sways on the half note: one cycle every two beats of the loop. */
const START = { division: "1/2", sync: true };

/**
 * An auto pan you can plug in: its state, a panel that draws the movement and an engine that plays it, each its own file. Play the loop, pick a waveform and switch to tremolo.
 */
export default function BlockAutoPan() {
  const [state, setState] = useState<AutoPanState>(
    () => autoPanDevice.apply(autoPanDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine, tempo } = useDeviceLoop({
    create: createAutoPanEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, autoPanDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <AutoPanPanel
        onValueChange={setState}
        signal={signal}
        tempo={tempo}
        value={state}
      />
    </div>
  );
}
