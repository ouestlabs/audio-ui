import {
  UNLIMITER_WORKLET,
  type UnlimiterState,
  unlimiterSettings,
} from "@/registry-audio/bases/base/devices/unlimiter/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";
import type { EffectEngine } from "@/registry-audio/bases/base/lib/device-engine";
import {
  createFeed,
  type Feed,
} from "@/registry-audio/bases/base/lib/device-engine";

const RAMP_SECONDS = 0.01;

export interface UnlimiterEngine extends EffectEngine<UnlimiterState> {
  /** Resolves once the unlimiter is in the graph. Until then the sound passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * An unlimiter on the Web Audio API for an `UnlimiterState`:
 *
 * ```
 * input → dry ──────────────────────────────────┐
 *       → unlimiter (an AudioWorklet) → wet ────┴→ output
 * ```
 *
 * The browser has no unlimiter node: the unlimiter is the audio.js de-limiter in an
 * `AudioWorklet` loaded from a blob, fed only while it plays. Off, or until
 * it is ready, the sound goes round it, unchanged.
 */
export function createUnlimiterEngine(
  ctx: BaseAudioContext,
  initial: UnlimiterState
): UnlimiterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry).connect(output);
  wet.connect(output);
  dry.gain.value = 1;
  wet.gain.value = 0;

  let settings = unlimiterSettings(initial);
  let model: AudioWorkletNode | null = null;
  let disposed = false;
  let feed: Feed | null = null;

  /** The unlimiter in place of the dry sound while it plays and is loaded, fed only then. */
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

  const ready = loadWorklet(ctx, UNLIMITER_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-unlimiter", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "unlimiter" },
    });
    feed = createFeed([[input, model]]);
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
    ready,
    update: (state) => {
      settings = unlimiterSettings(state);
      route();
    },
  };
}
