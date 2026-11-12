import type { DeviceReadings, EffectEngine } from "@audio-ui/engine/device";
import { createFeed, type Feed } from "@audio-ui/engine/device";
import { loadWorklet } from "@audio-ui/engine/worklet";
import {
  COMPANDER_WORKLET,
  type CompanderState,
  companderSettings,
} from "@/components/audio-ui/devices/compander/device";

const RAMP_SECONDS = 0.01;

export interface CompanderEngine extends EffectEngine<CompanderState> {
  /** What it is taking off right now, in dB: where its curve is under the straight line of a clean sound. */
  readings: () => DeviceReadings;
  /** Resolves once the compander is in the graph. Until then the sound passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB it is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
}

/**
 * A compander on the Web Audio API for a `CompanderState`:
 *
 * ```
 * input → dry ──────────────────────────────────┐
 *       → compander (an AudioWorklet) → wet ────┴→ output
 * ```
 *
 * The browser has no compander node: the compander is the audio.js one in an
 * `AudioWorklet` loaded from a blob, fed only while it plays. Off, or until
 * it is ready, the sound goes round it, unchanged.
 */
export function createCompanderEngine(
  ctx: BaseAudioContext,
  initial: CompanderState
): CompanderEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry).connect(output);
  wet.connect(output);
  dry.gain.value = 1;
  wet.gain.value = 0;

  let settings = companderSettings(initial);
  let model: AudioWorkletNode | null = null;
  let reduction = 0;
  let disposed = false;
  let feed: Feed | null = null;

  /** The compander in place of the dry sound while it plays and is loaded, fed only then. */
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

  const ready = loadWorklet(ctx, COMPANDER_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-compander", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "compander" },
    });
    feed = createFeed([[input, model]]);
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
      for (const node of [input, dry, wet, output]) {
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
    update: (state) => {
      settings = companderSettings(state);
      route();
    },
  };
}
