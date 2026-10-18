"use client";

import {
  type DeviceState,
  defineDevice,
  deviceTools,
} from "@audio-ui/core/device";
import { useState } from "react";
import { DevicePanel } from "@/registry-audio/bases/base/audio/panels/device-panel";

/** The whole description of a device: its parameters, with ranges and units. Nothing else is written. */
const tremolo = defineDevice({
  description: "Moves the level up and down.",
  id: "acme.tremolo",
  name: "Tremolo",
  parameters: [
    { default: true, id: "on", kind: "toggle", label: "Active" },
    {
      default: 5,
      id: "rate",
      label: "Rate",
      max: 20,
      min: 0.5,
      scale: "log",
      step: 0.5,
      unit: "Hz",
    },
    {
      default: 50,
      id: "depth",
      label: "Depth",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

type TremoloState = DeviceState<typeof tremolo.parameters>;

const [set] = deviceTools(tremolo);

/** What a model might send: out of range, and a word where a number goes. */
const CALL = { depth: "a lot", rate: 300 };

/**
 * One description gives a panel, a state and the tools an agent drives it with.
 * Turn the knobs, or press the button to send the call a model could send: the
 * values are brought into range, the wrong one is refused by name, and the
 * panel follows.
 */
export default function DeviceContractDemo() {
  const [state, setState] = useState<TremoloState>(() => tremolo.defaults());
  const [summary, setSummary] = useState(
    "The answer the model gets appears here."
  );
  const send = () => {
    const result = set?.run(state, CALL);
    if (result) {
      setState(result.state as TremoloState);
      setSummary(result.summary);
    }
  };
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <DevicePanel device={tremolo} onValueChange={setState} value={state} />
      <div className="flex min-w-0 flex-col gap-3 text-sm">
        <div>
          <p className="font-medium">State</p>
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(state, null, 2)}
          </pre>
        </div>
        <div>
          <p className="font-medium">
            Tool <code>{set?.name}</code>
          </p>
          <button
            className="mt-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
            onClick={send}
            type="button"
          >
            Send {JSON.stringify(CALL)}
          </button>
          <p aria-live="polite" className="mt-2 text-muted-foreground text-xs">
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
}
