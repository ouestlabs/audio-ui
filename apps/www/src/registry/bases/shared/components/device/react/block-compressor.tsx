import { useState } from "react";
import {
  type CompressorState,
  compressorDevice,
} from "@/registry/bases/shared/devices/compressor/device";
import { createCompressorEngine } from "@/registry/bases/shared/devices/compressor/engine";
import { CompressorPanel } from "@/registry/bases/shared/devices/compressor/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A compressor you can plug in: its state, a panel that draws it, an engine
 * that plays it, side by side. Each is its own file and none knows the others:
 * the state is a plain object, so a host keeps its own and uses what it needs.
 * Play it from its session and turn the knobs: the dot rides the curve at the
 * level going in, and the meters at the edge show what goes in, what comes
 * off and what comes out.
 */
export default function BlockCompressor() {
  const [state, setState] = useState<CompressorState>(() =>
    compressorDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createCompressorEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, compressorDevice);

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <CompressorPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
