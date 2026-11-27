import { useState } from "react";
import {
  type ExciterState,
  exciterDevice,
} from "@/registry/bases/shared/devices/exciter/device";
import { createExciterEngine } from "@/registry/bases/shared/devices/exciter/engine";
import { ExciterPanel } from "@/registry/bases/shared/devices/exciter/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * An exciter you can plug in: its state, a panel that draws the band it
 * excites and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and raise the amount: it comes forward.
 */
export default function BlockExciter() {
  const [state, setState] = useState<ExciterState>(() =>
    exciterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createExciterEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, exciterDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ExciterPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
