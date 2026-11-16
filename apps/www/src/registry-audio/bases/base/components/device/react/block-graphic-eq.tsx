import { useState } from "react";
import {
  type GraphicEqState,
  graphicEqDevice,
} from "@/registry-audio/bases/base/devices/graphic-eq/device";
import { createGraphicEqEngine } from "@/registry-audio/bases/base/devices/graphic-eq/engine";
import { GraphicEqPanel } from "@/registry-audio/bases/base/devices/graphic-eq/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry-audio/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A graphic EQ you can plug in: its state, a panel that draws the curve over a
 * fader per band and an engine that plays it, each its own file and none
 * knowing the others. Play the loop and pull the faders.
 */
export default function BlockGraphicEq() {
  const [state, setState] = useState<GraphicEqState>(() =>
    graphicEqDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createGraphicEqEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, graphicEqDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <GraphicEqPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
