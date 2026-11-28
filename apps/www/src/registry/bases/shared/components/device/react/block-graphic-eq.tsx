import { useState } from "react";
import {
  type GraphicEqState,
  graphicEqDevice,
} from "@/registry/bases/shared/devices/graphic-eq/device";
import { createGraphicEqEngine } from "@/registry/bases/shared/devices/graphic-eq/engine";
import { GraphicEqPanel } from "@/registry/bases/shared/devices/graphic-eq/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";

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
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createGraphicEqEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, graphicEqDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <GraphicEqPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
