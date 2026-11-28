import { useState } from "react";
import {
  type LimiterState,
  limiterDevice,
} from "@/registry/bases/shared/devices/limiter/device";
import { createLimiterEngine } from "@/registry/bases/shared/devices/limiter/engine";
import { LimiterPanel } from "@/registry/bases/shared/devices/limiter/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";

const MASTER_VOLUME = 0.7;

/**
 * A limiter you can plug in: its state, a panel that draws its transfer curve with a handle on the ceiling and an engine that plays it, each its own file. Play the loop, push the gain and pull the ceiling down.
 */
export default function BlockLimiter() {
  const [state, setState] = useState<LimiterState>(() =>
    limiterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createLimiterEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, limiterDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <LimiterPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
