"use client";

import { useState } from "react";
import { FilterPanel } from "@/registry-audio/bases/base/audio/panels/filter-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";
import {
  type FilterState,
  filterDevice,
} from "@/registry-audio/bases/base/lib/filter-device";
import { createFilterEngine } from "@/registry-audio/bases/base/lib/filter-engine";

const MASTER_VOLUME = 0.7;
const MIN_HZ = 20;
const MAX_HZ = 20_000;

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
  const { analyser } = useDeviceLoop({
    create: createFilterEngine,
    destination: master,
    state,
  });
  const spectrum = useSpectrum(analyser, { maxHz: MAX_HZ, minHz: MIN_HZ });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <FilterPanel onValueChange={setState} spectrum={spectrum} value={state} />
    </div>
  );
}
