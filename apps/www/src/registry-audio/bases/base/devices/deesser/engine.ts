import { toWebAudioQ } from "@audio-ui/core/analysis";
import type { DeviceBinding, DeviceReadings } from "@audio-ui/core/device";
import {
  CROSSOVER_Q,
  DEESSER_WORKLET,
  type DeesserState,
  deesserSettings,
  deesserTable,
} from "@/registry-audio/bases/base/devices/deesser/device";
import {
  KEY_DETECTOR_PARAMETERS,
  loadKeyDetector,
} from "@/registry-audio/bases/base/devices/key-detector";

const RAMP_SECONDS = 0.01;
/** How long after the other models fade out their input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the other models into a context once. `false` when the context cannot run worklets. */
function loadModels(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([DEESSER_WORKLET], { type: "text/javascript" })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

export interface DeesserEngine extends DeviceBinding<DeesserState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** What the highs are taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the detector and the other models are in the graph. Until then the highs pass unchanged, and the clean model plays for the others. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB the highs are taken down by right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
}

/**
 * A de-esser on the Web Audio API for a `DeesserState`:
 *
 * ```
 * input → low-pass ×2 → lows ─────────────────────────┐
 *       → high-pass ×2 → highs gain ──────────────────┴→ clean ─┐
 *                      ↘ detector → floor → the highs' gain     │
 *       → other models (an AudioWorklet) → model wet ───────────┴→ output
 * ```
 *
 * The clean model is the split: two biquads in a row make each half of a
 * Linkwitz-Riley split, which add back to a flat response with no detector.
 * The detector is the one of the compressor's key: it reads the highs and
 * writes the gain they get, and a table keeps it from going under the range.
 * Until it is ready the highs pass. The other models are the audio.js
 * de-esser in an `AudioWorklet`, fed only while one plays: until it is
 * ready, the clean model plays for them.
 */
export function createDeesserEngine(
  ctx: BaseAudioContext,
  initial: DeesserState
): DeesserEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const lowA = ctx.createBiquadFilter();
  const lowB = ctx.createBiquadFilter();
  const lows = ctx.createGain();
  const highA = ctx.createBiquadFilter();
  const highB = ctx.createBiquadFilter();
  const highs = ctx.createGain();
  const clamp = ctx.createWaveShaper();
  lowA.type = "lowpass";
  lowB.type = "lowpass";
  highA.type = "highpass";
  highB.type = "highpass";
  // The node takes the Q of a low-pass or high-pass in dB: this is the Butterworth one, -3 dB.
  for (const filter of [lowA, lowB, highA, highB]) {
    filter.Q.value = toWebAudioQ("lowcut", CROSSOVER_Q);
  }
  const clean = ctx.createGain();
  const modelWet = ctx.createGain();
  input.connect(lowA).connect(lowB).connect(lows).connect(clean);
  input.connect(highA).connect(highB).connect(highs).connect(clean);
  clean.connect(output);
  modelWet.connect(output);
  modelWet.gain.value = 0;

  let settings = deesserSettings(initial);
  let { floor } = settings;
  clamp.curve = deesserTable(floor);
  for (const filter of [lowA, lowB, highA, highB]) {
    filter.frequency.value = settings.frequency;
  }
  lows.gain.value = settings.lowGain;
  highs.gain.value = 1;

  let detector: AudioWorkletNode | null = null;
  let model: AudioWorkletNode | null = null;
  let reduction = 0;
  let modelReduction = 0;
  let disposed = false;
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;
  let latest = initial;

  /** The other models in place of the clean one while one plays and is loaded, fed only then. */
  const route = () => {
    const modeled = model === null ? 0 : settings.modelWet;
    clean.gain.setTargetAtTime(1 - modeled, ctx.currentTime, RAMP_SECONDS);
    modelWet.gain.setTargetAtTime(modeled, ctx.currentTime, RAMP_SECONDS);
    // As values, not glides: every one makes the model again, which fades it in.
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
    clearTimeout(unfeed);
    if (modeled > 0 && !fed && model) {
      input.connect(model);
      fed = true;
    } else if (modeled === 0 && fed) {
      // Once the fade is over: a worklet fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && model) {
          input.disconnect(model);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };
  const setDetector = (time: number) => {
    for (const name of KEY_DETECTOR_PARAMETERS) {
      detector?.parameters.get(name)?.setValueAtTime(settings[name], time);
    }
  };
  const modelsReady = loadModels(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-deesser", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "deesser" },
    });
    model.port.onmessage = (event: MessageEvent<number>) => {
      modelReduction = event.data;
    };
    model.connect(modelWet);
    settings = deesserSettings(latest);
    route();
    return true;
  });
  const keyReady = loadKeyDetector(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    detector = new AudioWorkletNode(ctx, "audioui-compressor-key", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    detector.port.onmessage = (event: MessageEvent<number>) => {
      reduction = event.data;
    };
    setDetector(0);
    highB.connect(detector);
    detector.connect(clamp).connect(highs.gain);
    highs.gain.value = 0;
    return true;
  });
  const ready = Promise.all([keyReady, modelsReady]).then((both) =>
    both.every(Boolean)
  );
  const reductionNow = () =>
    model && settings.modelWet > 0 ? modelReduction : reduction;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(unfeed);
      detector?.disconnect();
      model?.disconnect();
      for (const node of [
        clean,
        modelWet,
        input,
        lowA,
        lowB,
        lows,
        highA,
        highB,
        highs,
        clamp,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return reductionNow();
    },
    readings: (): DeviceReadings => ({ gainReductionDb: reductionNow() }),
    ready,
    update: (state) => {
      latest = state;
      settings = deesserSettings(state);
      route();
      for (const filter of [lowA, lowB, highA, highB]) {
        follow(filter.frequency, settings.frequency);
      }
      follow(lows.gain, settings.lowGain);
      setDetector(ctx.currentTime);
      if (settings.floor !== floor) {
        ({ floor } = settings);
        clamp.curve = deesserTable(floor);
      }
    },
  };
}
