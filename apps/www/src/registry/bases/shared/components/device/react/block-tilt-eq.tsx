import { useState } from "react";
import {
  type TiltEqState,
  tiltEqDevice,
} from "@/registry/bases/shared/devices/tilt-eq/device";
import { createTiltEqEngine } from "@/registry/bases/shared/devices/tilt-eq/engine";
import { TiltEqPanel } from "@/registry/bases/shared/devices/tilt-eq/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A tilt EQ you can plug in: its state, a panel that draws the curve it tilts
 * and an engine that plays it, each its own file and none knowing the others.
 * Play the loop and turn the tilt: brighter one way, darker the other.
 */
export default function BlockTiltEq() {
  const [state, setState] = useState<TiltEqState>(() =>
    tiltEqDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createTiltEqEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, tiltEqDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <TiltEqPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
