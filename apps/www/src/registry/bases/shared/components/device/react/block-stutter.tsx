import { useState } from "react";
import {
  type StutterState,
  stutterDevice,
} from "@/registry/bases/shared/devices/stutter/device";
import { createStutterEngine } from "@/registry/bases/shared/devices/stutter/engine";
import { StutterPanel } from "@/registry/bases/shared/devices/stutter/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";

const MASTER_VOLUME = 0.7;

/**
 * A stutter you can plug in: its state, a panel that draws one interval and
 * an engine that plays it, each its own file and none knowing the others. Play
 * the loop and switch it on: it catches a slice and repeats it.
 */
export default function BlockStutter() {
  const [state, setState] = useState<StutterState>(() =>
    stutterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createStutterEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, stutterDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <StutterPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
