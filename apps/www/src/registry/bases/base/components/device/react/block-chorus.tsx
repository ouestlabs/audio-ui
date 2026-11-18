import { useState } from "react";
import {
  type ChorusState,
  chorusDevice,
} from "@/registry/bases/base/devices/chorus/device";
import { createChorusEngine } from "@/registry/bases/base/devices/chorus/engine";
import { ChorusPanel } from "@/registry/bases/base/devices/chorus/panel";
import { useDeviceLoop } from "@/registry/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A chorus you can plug in: its state, a panel that draws the sweep of its
 * delay and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and turn the rate and the depth.
 */
export default function BlockChorus() {
  const [state, setState] = useState<ChorusState>(() =>
    chorusDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine, tempo } = useDeviceLoop({
    create: createChorusEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, chorusDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ChorusPanel
        onValueChange={setState}
        signal={signal}
        tempo={tempo}
        value={state}
      />
    </div>
  );
}
