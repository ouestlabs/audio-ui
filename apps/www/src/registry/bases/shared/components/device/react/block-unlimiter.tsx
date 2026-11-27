import { useState } from "react";
import {
  type UnlimiterState,
  unlimiterDevice,
} from "@/registry/bases/shared/devices/unlimiter/device";
import { createUnlimiterEngine } from "@/registry/bases/shared/devices/unlimiter/engine";
import { UnlimiterPanel } from "@/registry/bases/shared/devices/unlimiter/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * An unlimiter you can plug in: its state, a panel that draws the lift it
 * gives an attack for its size and an engine that plays it, each its own file
 * and none knowing the others. Play the loop: its attacks are lifted back by
 * what they are missing.
 */
export default function BlockUnlimiter() {
  const [state, setState] = useState<UnlimiterState>(() =>
    unlimiterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createUnlimiterEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, unlimiterDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <UnlimiterPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
