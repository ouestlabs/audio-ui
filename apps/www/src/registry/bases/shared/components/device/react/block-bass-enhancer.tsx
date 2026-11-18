import { useState } from "react";
import {
  type BassEnhancerState,
  bassEnhancerDevice,
} from "@/registry/bases/shared/devices/bass-enhancer/device";
import { createBassEnhancerEngine } from "@/registry/bases/shared/devices/bass-enhancer/engine";
import { BassEnhancerPanel } from "@/registry/bases/shared/devices/bass-enhancer/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A bass enhancer you can plug in: its state, a panel that draws the sub it
 * takes and where its harmonics go, and an engine that plays it, each its own
 * file and none knowing the others. Play the loop on small speakers and raise
 * the amount: the bass comes through.
 */
export default function BlockBassEnhancer() {
  const [state, setState] = useState<BassEnhancerState>(() =>
    bassEnhancerDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createBassEnhancerEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, bassEnhancerDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <BassEnhancerPanel
        onValueChange={setState}
        signal={signal}
        value={state}
      />
    </div>
  );
}
