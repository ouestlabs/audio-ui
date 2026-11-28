import { useState } from "react";
import {
  type RotaryState,
  rotaryDevice,
} from "@/registry/bases/shared/devices/rotary/device";
import { createRotaryEngine } from "@/registry/bases/shared/devices/rotary/engine";
import { RotaryPanel } from "@/registry/bases/shared/devices/rotary/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";

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
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createRotaryEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, rotaryDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <RotaryPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
