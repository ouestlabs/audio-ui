import type { DeviceReadings, SidechainBinding } from "@audio-ui/core/device";
import {
  COMPRESSOR_LOOKAHEAD_SECONDS,
  COMPRESSOR_MODELS_WORKLET,
  type CompressorState,
  compressorSettings,
} from "@/components/audio-ui/devices/compressor/device";
import {
  KEY_DETECTOR_PARAMETERS,
  loadKeyDetector,
} from "@/components/audio-ui/devices/key-detector";

/** How fast a parameter follows a change, as a time constant in seconds: fast enough to feel direct, slow enough not to click. */
const RAMP_SECONDS = 0.01;
/** How long a path faded to silence plays on before it is taken out of the graph: ten time constants, under -80 dB. */
const SETTLE_MS = RAMP_SECONDS * 10 * 1000;

/**
 * The link from `from` to `to`, made while what goes through it is heard:
 * `set(true)` makes it at once, `set(false)` takes it out once a ramp to
 * silence has played. A path that is not linked to the output is not
 * rendered at all, so a path set to silence costs nothing.
 */
function link(from: AudioNode, to: AudioNode, on: boolean) {
  let linked = on;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (on) {
    from.connect(to);
  }
  return (wanted: boolean) => {
    if (wanted) {
      clearTimeout(timer);
      timer = undefined;
      if (!linked) {
        from.connect(to);
        linked = true;
      }
      return;
    }
    if (!linked || timer !== undefined) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      linked = false;
      try {
        from.disconnect(to);
      } catch {
        // Already taken apart: the engine was disposed while the path faded.
      }
    }, SETTLE_MS);
  };
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the models into a context once. `false` when the context cannot run worklets. */
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
    new Blob([COMPRESSOR_MODELS_WORKLET], { type: "text/javascript" })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

export interface CompressorEngine
  extends SidechainBinding<CompressorState, AudioNode> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** What it is taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the detector of the key and the models can be made: from then on each is in the graph whenever it plays. Until then a keyed compressor passes the signal unchanged, and a model other than the clean one plays the clean one. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB the compressor is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
  /** Connect the key here: with `external` on, the compressor follows this signal's level instead of the one it processes. It is only listened to, never heard. */
  readonly sidechain: AudioNode;
}

/**
 * A compressor on the Web Audio API for a `CompressorState`:
 *
 * ```
 * input → delay (the node's lookahead) → dry ───────────────────────┐
 *       │                               → keyed gain → trim → wet ──┤
 *       │                               → models (an AudioWorklet) → trim → wet ┤
 *       → DynamicsCompressorNode → trim → wet ──────────────────────┴→ output
 * sidechain → detector (an AudioWorklet) → the keyed gain's own gain
 * ```
 *
 * The clean model is the node. With `external` on it goes through the keyed
 * gain instead, which a detector drives from the sidechain: the same curve as
 * the node's (a soft knee, a ratio), the node's make-up added by hand since
 * there is no node. The other models are an `AudioWorklet` of the audio.js
 * processors, the make-up after it: until it is ready, the node plays for
 * them. The dry path, the keyed gain and the models wait as long as the node
 * looks ahead, so a mix does not comb and the latency is the same for every
 * model. A path reaches the output only while it is heard, the models are fed
 * only while one plays, and the detector is made the first time the key is
 * on: a clean compressor at full mix with no key renders the node and nothing
 * else. Parameters move with `setTargetAtTime`, never `.value =`,
 * so a knob turned while it plays does not click. What goes on each node
 * comes from `compressorSettings`, which is pure and tested.
 */
export function createCompressorEngine(
  ctx: BaseAudioContext,
  initial: CompressorState
): CompressorEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  const lookahead = ctx.createDelay(COMPRESSOR_LOOKAHEAD_SECONDS * 4);
  const dry = ctx.createGain();
  const trim = ctx.createGain();
  const wet = ctx.createGain();
  const sidechain = ctx.createGain();
  const keyed = ctx.createGain();
  const keyedTrim = ctx.createGain();
  const keyedWet = ctx.createGain();
  const modelTrim = ctx.createGain();
  const modelWet = ctx.createGain();
  lookahead.delayTime.value = COMPRESSOR_LOOKAHEAD_SECONDS;

  const first = compressorSettings(initial);
  // Each path reaches the output only while it is heard: a compressor at full mix with no key renders the node alone.
  input.connect(lookahead).connect(dry);
  input.connect(compressor).connect(trim).connect(wet);
  lookahead.connect(keyed).connect(keyedTrim).connect(keyedWet);
  modelTrim.connect(modelWet);
  const dryPath = link(dry, output, first.dry > 0);
  // Until the models are ready, the node plays for them.
  const nodePath = link(wet, output, first.nativeWet + first.modelWet > 0);
  const keyedPath = link(keyedWet, output, first.keyedWet > 0);
  const modelPath = link(modelWet, output, false);
  let models: AudioWorkletNode | null = null;
  let feed: ((on: boolean) => void) | null = null;
  let modelReduction = 0;
  let sentModel = initial.model;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  let detector: AudioWorkletNode | null = null;
  let keyedReduction = 0;
  let current = first;
  let latest = initial;
  const setDetector = (time: number) => {
    for (const name of KEY_DETECTOR_PARAMETERS) {
      detector?.parameters.get(name)?.setValueAtTime(current[name], time);
    }
  };

  let disposed = false;
  let canDetect = false;
  // The key's detector, an AudioWorklet, is made the first time the key is on: until then it costs nothing.
  const detect = () => {
    if (detector || !canDetect || disposed || !current.external) {
      return;
    }
    detector = new AudioWorkletNode(ctx, "audioui-compressor-key", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    detector.port.onmessage = (event: MessageEvent<number>) => {
      keyedReduction = event.data;
    };
    setDetector(0);
    sidechain.connect(detector);
    keyed.gain.value = 0;
    detector.connect(keyed.gain);
  };

  /** The models' parameters, as values and not glides: a change that makes a model again is faded in by the worklet. */
  const setModels = (time: number) => {
    for (const [name, value] of Object.entries(current.modelParams)) {
      models?.parameters.get(name)?.setValueAtTime(value, time);
    }
    if (models && current.modelWet > 0 && current.model !== sentModel) {
      sentModel = current.model;
      models.port.postMessage({ model: current.model });
    }
  };

  const update = (state: CompressorState) => {
    latest = state;
    const settings = compressorSettings(state);
    current = settings;
    detect();
    setDetector(ctx.currentTime);
    setModels(ctx.currentTime);
    // Until the models are ready, the node plays for them.
    const modeled = models === null ? 0 : settings.modelWet;
    dryPath(settings.dry > 0);
    nodePath(settings.nativeWet + settings.modelWet - modeled > 0);
    keyedPath(settings.keyedWet > 0);
    modelPath(modeled > 0);
    feed?.(modeled > 0);
    follow(modelTrim.gain, 10 ** (settings.modelTrimDb / 20));
    follow(modelWet.gain, modeled);
    follow(keyedTrim.gain, 10 ** (settings.keyedTrimDb / 20));
    follow(keyedWet.gain, settings.keyedWet);
    follow(compressor.threshold, settings.threshold);
    follow(compressor.ratio, settings.ratio);
    follow(compressor.knee, settings.knee);
    follow(compressor.attack, settings.attack);
    follow(compressor.release, settings.release);
    follow(trim.gain, 10 ** (settings.trimDb / 20));
    follow(dry.gain, settings.dry);
    follow(wet.gain, settings.nativeWet + settings.modelWet - modeled);
  };

  // A fresh node has its own defaults: set the first state outright, ramps come after.
  compressor.threshold.value = first.threshold;
  compressor.ratio.value = first.ratio;
  compressor.knee.value = first.knee;
  compressor.attack.value = first.attack;
  compressor.release.value = first.release;
  trim.gain.value = 10 ** (first.trimDb / 20);
  dry.gain.value = first.dry;
  wet.gain.value = first.nativeWet + first.modelWet;
  keyedTrim.gain.value = 10 ** (first.keyedTrimDb / 20);
  keyedWet.gain.value = first.keyedWet;
  modelTrim.gain.value = 10 ** (first.modelTrimDb / 20);
  modelWet.gain.value = 0;

  const ready = Promise.all([loadKeyDetector(ctx), loadModels(ctx)]).then(
    ([keyOk, modelsOk]) => {
      if (disposed) {
        return false;
      }
      if (keyOk) {
        canDetect = true;
        detect();
      }
      if (modelsOk) {
        sentModel = current.model === "clean" ? "smooth" : current.model;
        models = new AudioWorkletNode(ctx, "audioui-compressor-models", {
          outputChannelCount: [2],
          parameterData: current.modelParams,
          processorOptions: { model: sentModel },
        });
        models.port.onmessage = (event: MessageEvent<number>) => {
          modelReduction = event.data;
        };
        models.connect(modelTrim);
        feed = link(lookahead, models, false);
        update(latest);
      }
      return keyOk && modelsOk;
    }
  );

  const reductionNow = () => {
    if (current.external) {
      return keyedReduction;
    }
    return models && current.modelWet > 0
      ? modelReduction
      : compressor.reduction;
  };

  return {
    dispose: () => {
      disposed = true;
      detector?.disconnect();
      models?.disconnect();
      for (const node of [
        sidechain,
        keyed,
        keyedTrim,
        keyedWet,
        modelTrim,
        modelWet,
        input,
        lookahead,
        dry,
        compressor,
        trim,
        wet,
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
    sidechain,
    update,
  };
}