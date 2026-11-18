import { useState } from "react";
import {
  type DeesserState,
  deesserDevice,
} from "@/registry/bases/base/devices/deesser/device";
import { createDeesserEngine } from "@/registry/bases/base/devices/deesser/engine";
import { DeesserPanel } from "@/registry/bases/base/devices/deesser/panel";
import { useDeviceLoop } from "@/registry/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A de-esser you can plug in: its state, a panel that draws what it does at
 * each frequency and an engine that plays it, each its own file and none
 * knowing the others. It plays a loop: lower
 * the threshold and the highs sit back, switch Listen on to hear the highs alone.
 */
export default function BlockDeesser() {
  const [state, setState] = useState<DeesserState>(() =>
    deesserDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createDeesserEngine,
    destination: master,
    source: "groove",
    state,
  });
  const signal = useDeviceSignal(engine, deesserDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DeesserPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
