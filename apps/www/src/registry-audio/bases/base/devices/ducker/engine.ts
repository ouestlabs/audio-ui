import type { DeviceReadings, SidechainBinding } from "@audio-ui/core/device";
import {
  DUCKER_WORKLET,
  type DuckerState,
  duckerSettings,
} from "@/registry-audio/bases/base/devices/ducker/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";
import {
  createFeed,
  type Feed,
} from "@/registry-audio/bases/base/lib/device-engine";

const RAMP_SECONDS = 0.01;

export interface DuckerEngine extends SidechainBinding<DuckerState, AudioNode> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** What it is taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the ducker is in the graph. Until then the sound passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB it is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
  /** Connect the key here: the sound is turned down while it plays. It is only listened to, never heard. With nothing connected, the ducker follows the sound itself. */
  readonly sidechain: AudioNode;
}

/**
 * A ducker on the Web Audio API for a `DuckerState`:
 *
 * ```
 * input → dry ─────────────────────────────────┐
 *       → ducker (an AudioWorklet) → wet ──────┴→ output
 * sidechain ↗ (its second input)
 * ```
 *
 * The browser has no ducker node: the ducker is the audio.js one in an
 * `AudioWorklet` loaded from a blob, the sound on its first input and the key
 * on its second, fed only while it plays. Off, or until it is ready, the
 * sound goes round it, unchanged.
 */
export function createDuckerEngine(
  ctx: BaseAudioContext,
  initial: DuckerState
): DuckerEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const sidechain = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry).connect(output);
  wet.connect(output);
  dry.gain.value = 1;
  wet.gain.value = 0;

  let settings = duckerSettings(initial);
  let model: AudioWorkletNode | null = null;
  let reduction = 0;
  let disposed = false;
  let feed: Feed | null = null;

  /** The ducker in place of the dry sound while it plays and is loaded, fed only then. */
  const route = () => {
    const playing = model === null ? 0 : settings.wet;
    dry.gain.setTargetAtTime(1 - playing, ctx.currentTime, RAMP_SECONDS);
    wet.gain.setTargetAtTime(playing, ctx.currentTime, RAMP_SECONDS);
    // As values: the ones it reads as it plays change at once, the others make it again, which fades it in.
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
    feed?.set(playing > 0);
  };

  const ready = loadWorklet(ctx, DUCKER_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-ducker", {
      numberOfInputs: 2,
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "ducker" },
    });
    feed = createFeed([
      [input, model, 0, 0],
      [sidechain, model, 0, 1],
    ]);
    model.port.onmessage = (event: MessageEvent<number>) => {
      reduction = event.data;
    };
    model.connect(wet);
    route();
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      feed?.dispose();
      model?.disconnect();
      for (const node of [input, sidechain, dry, wet, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return settings.wet > 0 ? reduction : 0;
    },
    readings: (): DeviceReadings => ({
      gainReductionDb: settings.wet > 0 ? reduction : 0,
    }),
    ready,
    sidechain,
    update: (state) => {
      settings = duckerSettings(state);
      route();
    },
  };
}
