import { useState } from "react";
import {
  type ReduxState,
  reduxDevice,
} from "@/registry/bases/shared/devices/redux/device";
import { createReduxEngine } from "@/registry/bases/shared/devices/redux/engine";
import { ReduxPanel } from "@/registry/bases/shared/devices/redux/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";

const MASTER_VOLUME = 0.7;

/**
 * A redux you can plug in: its state, a panel that draws the stairs the bits
 * make and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and take the bits down: the stairs grow as the sound
 * roughens.
 */
export default function BlockRedux() {
  const [state, setState] = useState<ReduxState>(() => reduxDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createReduxEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, reduxDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ReduxPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
