import { useState } from "react";
import {
  type DelayState,
  delayDevice,
} from "@/registry/bases/shared/devices/delay/device";
import { createDelayEngine } from "@/registry/bases/shared/devices/delay/engine";
import { DelayPanel } from "@/registry/bases/shared/devices/delay/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";

const MASTER_VOLUME = 0.7;
/** A dotted eighth: the echo that has made a thousand guitars sound larger. */
const START = { division: "1/8d", sync: true };

/**
 * A delay you can plug in: its state, a panel that draws the echoes it makes
 * and an engine that plays it, each its own file and none knowing the others.
 * Play the loop and drag the handle: across for the time, up for the feedback.
 * It starts synced to the loop's tempo, on a dotted eighth.
 */
export default function BlockDelay() {
  const [state, setState] = useState<DelayState>(
    () => delayDevice.apply(delayDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine, tempo } = useDeviceLoop({
    create: createDelayEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, delayDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DelayPanel
        onValueChange={setState}
        signal={signal}
        tempo={tempo}
        value={state}
      />
    </div>
  );
}
