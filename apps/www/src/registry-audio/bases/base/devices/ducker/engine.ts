import type { DeviceReadings, SidechainBinding } from "@audio-ui/core/device";
import {
  DUCKER_WORKLET,
  type DuckerState,
  duckerSettings,
} from "@/registry-audio/bases/base/devices/ducker/device";

const RAMP_SECONDS = 0.01;
/** How long after the ducker fades out its inputs are taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

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

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the ducker into a context once. `false` when the context cannot run worklets. */
function loadDucker(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([DUCKER_WORKLET], { type: "text/javascript" })
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
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;

  /** The ducker in place of the dry sound while it plays and is loaded, fed only then. */
  const route = () => {
    const playing = model === null ? 0 : settings.wet;
    dry.gain.setTargetAtTime(1 - playing, ctx.currentTime, RAMP_SECONDS);
    wet.gain.setTargetAtTime(playing, ctx.currentTime, RAMP_SECONDS);
    // As values: the ones it reads as it plays change at once, the others make it again, which fades it in.
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
    clearTimeout(unfeed);
    if (playing > 0 && !fed && model) {
      input.connect(model, 0, 0);
      sidechain.connect(model, 0, 1);
      fed = true;
    } else if (playing === 0 && fed) {
      // Once the fade is over: a worklet fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && model) {
          input.disconnect(model);
          sidechain.disconnect(model);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };

  const ready = loadDucker(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-ducker", {
      numberOfInputs: 2,
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "ducker" },
    });
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
      clearTimeout(unfeed);
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
