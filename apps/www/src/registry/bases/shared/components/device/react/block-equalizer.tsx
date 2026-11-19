import { useState } from "react";
import {
  type EqualizerState,
  equalizerDevice,
} from "@/registry/bases/shared/devices/equalizer/device";
import { createEqualizerEngine } from "@/registry/bases/shared/devices/equalizer/engine";
import { EqualizerPanel } from "@/registry/bases/shared/devices/equalizer/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;
/** A shape worth looking at: some weight, a dip in the low mids, some air. */
const START = { highDb: 5, lowDb: 3, lowMidDb: -4 };

/**
 * An equalizer you can plug in: its state, a panel that draws it and an engine
 * that plays it, each its own file and none knowing the others. A loop
 * plays through it while its session's play switch is on, and the spectrum
 * behind the curve is what comes out.
 */
export default function BlockEqualizer() {
  const [state, setState] = useState<EqualizerState>(
    () => equalizerDevice.apply(equalizerDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createEqualizerEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, equalizerDevice);

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <EqualizerPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
