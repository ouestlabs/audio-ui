import { useState } from "react";
import {
  type FilterState,
  filterDevice,
} from "@/registry/bases/base/devices/filter/device";
import { createFilterEngine } from "@/registry/bases/base/devices/filter/engine";
import { FilterPanel } from "@/registry/bases/base/devices/filter/panel";
import { useDeviceLoop } from "@/registry/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A filter you can plug in: its state, a panel that draws the curve it plays
 * with a handle on the cutoff and an engine that plays it, each its own file
 * and none knowing the others. Play the loop and drag the handle: across for
 * the cutoff, up for the resonance; the spectrum behind is what comes out.
 */
export default function BlockFilter() {
  const [state, setState] = useState<FilterState>(() =>
    filterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createFilterEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, filterDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <FilterPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
