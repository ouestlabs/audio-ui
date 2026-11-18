import { useState } from "react";
import {
  type DuckerState,
  duckerDevice,
} from "@/registry/bases/base/devices/ducker/device";
import { createDuckerEngine } from "@/registry/bases/base/devices/ducker/engine";
import { DuckerPanel } from "@/registry/bases/base/devices/ducker/panel";
import { useDeviceLoop } from "@/registry/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;
/** A deep, quick duck that breathes back between the kicks. */
const START = {
  attackMs: 5,
  rangeDb: 18,
  releaseMs: 180,
  thresholdDb: -36,
};

/**
 * A ducker you can plug in: its state, a panel that draws the gain it puts on
 * the sound for the key's level and an engine that plays it, each its own
 * file. A held chord, ducked by the kick of the loop: lower the threshold or
 * raise the range and it pumps harder, lengthen the release and it breathes.
 */
export default function BlockDucker() {
  const [state, setState] = useState<DuckerState>(
    () => duckerDevice.apply(duckerDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createDuckerEngine,
    destination: master,
    key: true,
    source: "chord",
    state,
  });
  const signal = useDeviceSignal(engine, duckerDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DuckerPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
