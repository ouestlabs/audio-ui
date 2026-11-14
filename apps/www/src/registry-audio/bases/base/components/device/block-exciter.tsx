import { useState } from "react";
import {
  type ExciterState,
  exciterDevice,
} from "@/registry-audio/bases/base/devices/exciter/device";
import { createExciterEngine } from "@/registry-audio/bases/base/devices/exciter/engine";
import { ExciterPanel } from "@/registry-audio/bases/base/devices/exciter/panel";
import { useDeviceSignal } from "@/registry-audio/bases/base/hooks/use-device-signal";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

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
  const { engine } = useDeviceLoop({
    create: createExciterEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, exciterDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ExciterPanel signal={signal} onValueChange={setState} value={state} />
    </div>
  );
}
