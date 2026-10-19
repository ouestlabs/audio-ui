"use client";

import { useState } from "react";
import { DeesserPanel } from "@/registry-audio/bases/base/audio/panels/deesser-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";
import {
  type DeesserState,
  deesserDevice,
} from "@/registry-audio/bases/base/lib/deesser-device";
import { createDeesserEngine } from "@/registry-audio/bases/base/lib/deesser-engine";

const MASTER_VOLUME = 0.7;
const MIN_HZ = 500;
const MAX_HZ = 20_000;

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
  const { analyser } = useDeviceLoop({
    create: createDeesserEngine,
    destination: master,
    source: "groove",
    state,
  });
  const spectrum = useSpectrum(analyser, { maxHz: MAX_HZ, minHz: MIN_HZ });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DeesserPanel
        onValueChange={setState}
        spectrum={spectrum}
        value={state}
      />
    </div>
  );
}
