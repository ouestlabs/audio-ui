import {
  CIRCUIT_WORKLET,
  circuitSettings,
  type FilterState,
} from "@/registry-audio/bases/base/devices/filter/device";

/** How fast a knob follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.015;

export interface FilterEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the circuits are in the graph. Until then the signal passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: FilterState) => void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the circuits into a context once. `false` when the context cannot run worklets. */
function loadCircuits(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([CIRCUIT_WORKLET], { type: "text/javascript" })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/**
 * A filter on the Web Audio API for a `FilterState`:
 *
 * ```
 * input → circuit (an AudioWorklet) → analog ─→ wet ─┐
 *       → dry (until it is ready, or off) ───────────┴→ output
 * ```
 *
 * The circuit is an `AudioWorklet` loaded from a blob. Until it is ready the
 * signal passes unchanged. Off, the signal goes round it. Parameters move
 * with `setTargetAtTime`, never `.value =`, so a sweep does not click; a change
 * of circuit or type is a message, the new one starting from rest.
 */
export function createFilterEngine(
  ctx: BaseAudioContext,
  initial: FilterState
): FilterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  wet.connect(output);
  input.connect(dry).connect(output);
  wet.gain.value = 0;
  dry.gain.value = 1;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  let circuit: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;
  let sent = "";

  const route = (state: FilterState) => {
    if (!circuit) {
      return;
    }
    const settings = circuitSettings(state);
    const message = `${settings.circuit} ${settings.type}`;
    if (message !== sent) {
      sent = message;
      circuit.port.postMessage({
        circuit: settings.circuit,
        type: settings.type,
      });
    }
    follow(circuit.parameters.get("cutoff") as AudioParam, settings.cutoff);
    follow(
      circuit.parameters.get("resonance") as AudioParam,
      settings.resonance
    );
    follow(circuit.parameters.get("drive") as AudioParam, settings.drive);
    follow(wet.gain, state.enabled ? 1 : 0);
    follow(dry.gain, state.enabled ? 0 : 1);
  };

  const ready = loadCircuits(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = circuitSettings(latest);
    circuit = new AudioWorkletNode(ctx, "audioui-filter-circuit", {
      parameterData: {
        cutoff: settings.cutoff,
        drive: settings.drive,
        resonance: settings.resonance,
      },
      processorOptions: { circuit: settings.circuit, type: settings.type },
    });
    sent = `${settings.circuit} ${settings.type}`;
    input.connect(circuit);
    circuit.connect(wet);
    route(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      circuit?.disconnect();
      for (const node of [input, wet, dry, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    ready,
    update: (state) => {
      latest = state;
      route(state);
    },
  };
}
