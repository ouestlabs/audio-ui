import { useState } from "react";
import {
  type MultibandState,
  multibandDevice,
} from "@/registry-audio/bases/base/devices/multiband/device";
import { createMultibandEngine } from "@/registry-audio/bases/base/devices/multiband/engine";
import { MultibandPanel } from "@/registry-audio/bases/base/devices/multiband/panel";
import { useDeviceSignal } from "@/registry-audio/bases/base/hooks/use-device-signal";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

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
      <MultibandPanel signal={signal}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
