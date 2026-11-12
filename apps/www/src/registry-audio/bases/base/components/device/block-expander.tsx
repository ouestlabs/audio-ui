import { useState } from "react";
import {
  type ExpanderState,
  expanderDevice,
} from "@/registry-audio/bases/base/devices/expander/device";
import { createExpanderEngine } from "@/registry-audio/bases/base/devices/expander/engine";
import { ExpanderPanel } from "@/registry-audio/bases/base/devices/expander/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

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
  useDeviceLoop({
    create: createExpanderEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ExpanderPanel onValueChange={setState} value={state} />
    </div>
  );
}
