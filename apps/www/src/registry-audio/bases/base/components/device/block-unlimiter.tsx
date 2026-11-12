import { useState } from "react";
import {
  type UnlimiterState,
  unlimiterDevice,
} from "@/registry-audio/bases/base/devices/unlimiter/device";
import { createUnlimiterEngine } from "@/registry-audio/bases/base/devices/unlimiter/engine";
import { UnlimiterPanel } from "@/registry-audio/bases/base/devices/unlimiter/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

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
  useDeviceLoop({
    create: createUnlimiterEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <UnlimiterPanel onValueChange={setState} value={state} />
    </div>
  );
}
