"use client";

import { useState } from "react";
import { DeesserPanel } from "@/registry-audio/bases/base/audio/panels/deesser-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type DeesserState,
  deesserDevice,
} from "@/registry-audio/bases/base/lib/deesser-device";
import { createDeesserEngine } from "@/registry-audio/bases/base/lib/deesser-engine";
import { renderSibilantLoop } from "@/registry-audio/bases/base/lib/demo-loop";

const MASTER_VOLUME = 0.7;

/**
 * A de-esser you can plug in: its state, a panel that draws what it does at
 * each frequency and an engine that plays it, each its own file and none
 * knowing the others. It plays a held vowel with an "s" on four beats: lower
 * the threshold and the s sits back, switch Listen on to hear the highs alone.
 */
export default function BlockDeesser() {
  const [state, setState] = useState<DeesserState>(() =>
    deesserDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createDeesserEngine,
    destination: master,
    signal: renderSibilantLoop,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DeesserPanel onValueChange={setState} value={state} />
    </div>
  );
}
