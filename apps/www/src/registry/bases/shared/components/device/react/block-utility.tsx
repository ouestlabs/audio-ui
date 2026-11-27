import { useState } from "react";
import {
  type UtilityState,
  utilityDevice,
} from "@/registry/bases/shared/devices/utility/device";
import { createUtilityEngine } from "@/registry/bases/shared/devices/utility/engine";
import { UtilityPanel } from "@/registry/bases/shared/devices/utility/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A utility you can plug in: its state, a panel and an engine that plays it, each its own file and none knowing the others. Play the loop and move the pan and the width.
 */
export default function BlockUtility() {
  const [state, setState] = useState<UtilityState>(() =>
    utilityDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createUtilityEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, utilityDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <UtilityPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
