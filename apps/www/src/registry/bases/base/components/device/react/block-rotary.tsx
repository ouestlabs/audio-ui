import { useState } from "react";
import {
  type RotaryState,
  rotaryDevice,
} from "@/registry/bases/base/devices/rotary/device";
import { createRotaryEngine } from "@/registry/bases/base/devices/rotary/engine";
import { RotaryPanel } from "@/registry/bases/base/devices/rotary/panel";
import { useDeviceLoop } from "@/registry/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A rotary speaker you can plug in: its state, a panel that draws its two
 * bands and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and switch to Fast: the rotors wind up.
 */
export default function BlockRotary() {
  const [state, setState] = useState<RotaryState>(() =>
    rotaryDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createRotaryEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, rotaryDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <RotaryPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
