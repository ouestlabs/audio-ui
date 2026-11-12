import { useState } from "react";
import {
  type RotaryState,
  rotaryDevice,
} from "@/registry-audio/bases/base/devices/rotary/device";
import { createRotaryEngine } from "@/registry-audio/bases/base/devices/rotary/engine";
import { RotaryPanel } from "@/registry-audio/bases/base/devices/rotary/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

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
  useDeviceLoop({
    create: createRotaryEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <RotaryPanel onValueChange={setState} value={state} />
    </div>
  );
}
