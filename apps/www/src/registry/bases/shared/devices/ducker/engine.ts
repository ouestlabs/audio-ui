import type {
  DeviceReadings,
  EffectEngine,
  SidechainBinding,
} from "@/engine/device";
import { loadWorklet } from "@/engine/worklet";
import {
  DUCKER_WORKLET,
  type DuckerState,
  duckerDevice,
} from "@/registry/bases/shared/devices/ducker/device";

const RAMP_SECONDS = 0.01;

export interface DuckerEngine
  extends EffectEngine<DuckerState>,
    SidechainBinding<DuckerState, AudioNode> {
  /** What it is taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the ducker is in the graph. Until then the sound passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB it is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
  /** Connect the key here: the sound is turned down while it plays. It is only listened to, never heard. With nothing connected, the ducker follows the sound itself. */
  readonly sidechain: AudioNode;
}

/** The state as the values of the worklet's parameters, by id, a toggle as 0 or 1. */
const parametersOf = (state: DuckerState) =>
  Object.fromEntries(
    duckerDevice.parameters.map(({ id }) => [id, Number(state[id])])
  );

/**
 * A ducker on the Web Audio API for a `DuckerState`:
 *
 * ```
 * input → ducker (an AudioWorklet) → output
 * sidechain ↗ (its second input)
 * ```
 *
 * The browser has no ducker node: the ducker is the device's processor, over
 * the audio.js one, in an `AudioWorklet` loaded from a blob, the sound on its
 * first input and the key on its second. Off, the processor lets the sound
 * through unchanged, and so does the engine until the worklet is ready.
 */
export function createDuckerEngine(
  ctx: BaseAudioContext,
  initial: DuckerState
): DuckerEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const sidechain = ctx.createGain();
  const dry = ctx.createGain();
  input.connect(dry).connect(output);

  let state = initial;
  let model: AudioWorkletNode | null = null;
  let reduction = 0;
  let disposed = false;

  /** As values: the processor reads them as it plays. */
  const send = () => {
    for (const [name, value] of Object.entries(parametersOf(state))) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
  };

  const ready = loadWorklet(ctx, DUCKER_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-ducker", {
      numberOfInputs: 2,
      outputChannelCount: [2],
      parameterData: parametersOf(state),
      processorOptions: { model: "ducker" },
    });
    input.connect(model, 0, 0);
    sidechain.connect(model, 0, 1);
    model.port.onmessage = (event: MessageEvent<number>) => {
      reduction = event.data;
    };
    model.connect(output);
    // The sound that went round it gives way to what comes out of it.
    dry.gain.setTargetAtTime(0, ctx.currentTime, RAMP_SECONDS);
    return true;
  });

  const gainReduction = () => (state.enabled ? reduction : 0);

  return {
    dispose: () => {
      disposed = true;
      model?.disconnect();
      for (const node of [input, sidechain, dry, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return gainReduction();
    },
    readings: (): DeviceReadings => ({ gainReductionDb: gainReduction() }),
    ready,
    sidechain,
    update: (next) => {
      state = next;
      send();
    },
  };
}
