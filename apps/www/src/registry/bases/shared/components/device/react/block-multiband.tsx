import { useState } from "react";
import {
  type MultibandState,
  multibandDevice,
} from "@/registry/bases/shared/devices/multiband/device";
import { createMultibandEngine } from "@/registry/bases/shared/devices/multiband/engine";
import { MultibandPanel } from "@/registry/bases/shared/devices/multiband/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A multiband compressor you can plug in: its state, a panel that draws the
 * three bands and an engine that plays it, each its own file and none knowing
 * the others. Play the loop, lower the threshold of one band and only that
 * band is held down.
 */
export default function BlockMultiband() {
  const [state, setState] = useState<MultibandState>(() =>
    multibandDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createMultibandEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, multibandDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <MultibandPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
