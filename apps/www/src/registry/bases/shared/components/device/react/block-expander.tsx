import { useState } from "react";
import {
  type ExpanderState,
  expanderDevice,
} from "@/registry/bases/shared/devices/expander/device";
import { createExpanderEngine } from "@/registry/bases/shared/devices/expander/engine";
import { ExpanderPanel } from "@/registry/bases/shared/devices/expander/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * An expander you can plug in: its state, a panel that draws its curve and
 * an engine that plays it, each its own file and none knowing the others. Play
 * the loop: downward, what falls under the threshold is turned down; upward,
 * the peaks are lifted.
 */
export default function BlockExpander() {
  const [state, setState] = useState<ExpanderState>(() =>
    expanderDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createExpanderEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, expanderDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ExpanderPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
