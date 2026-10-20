import type { DeviceReadings, SidechainBinding } from "@audio-ui/core/device";
import {
  COMPRESSOR_LOOKAHEAD_SECONDS,
  type CompressorState,
  compressorSettings,
} from "@/components/audio-ui/devices/compressor/device";
import {
  KEY_DETECTOR_PARAMETERS,
  loadKeyDetector,
} from "@/components/audio-ui/devices/key-detector";

/** How fast a parameter follows a change, as a time constant in seconds: fast enough to feel direct, slow enough not to click. */
const RAMP_SECONDS = 0.01;

export interface CompressorEngine
  extends SidechainBinding<CompressorState, AudioNode> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** What it is taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the detector of the key is in the graph. Until then a keyed compressor passes the signal unchanged. A context with no worklets never resolves it to `true`. */
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
 * input → delay (the node's lookahead) → dry ───────────────┐
 *       │                               → keyed gain → trim → wet ──┤
 *       → DynamicsCompressorNode → trim → wet ──────────────────────┴→ output
 * sidechain → detector (an AudioWorklet) → the keyed gain's own gain
 * ```
 *
 * Without the key the signal goes through the node. With `external` on it goes
 * through the keyed gain instead, which a detector drives from the sidechain:
 * the same curve as the node's (a soft knee, a ratio), the node's make-up added
 * by hand since there is no node. The dry path waits as long as the node looks ahead, so a mix of the two
 * does not comb. Parameters move with `setTargetAtTime`, never `.value =`,
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
  lookahead.delayTime.value = COMPRESSOR_LOOKAHEAD_SECONDS;

  input.connect(lookahead).connect(dry).connect(output);
  input.connect(compressor).connect(trim).connect(wet).connect(output);
  lookahead.connect(keyed).connect(keyedTrim).connect(keyedWet).connect(output);

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  let detector: AudioWorkletNode | null = null;
  let keyedReduction = 0;
  let current = compressorSettings(initial);
  const setDetector = (time: number) => {
    for (const name of KEY_DETECTOR_PARAMETERS) {
      detector?.parameters.get(name)?.setValueAtTime(current[name], time);
    }
  };

  const update = (state: CompressorState) => {
    const settings = compressorSettings(state);
    current = settings;
    setDetector(ctx.currentTime);
    follow(keyedTrim.gain, 10 ** (settings.keyedTrimDb / 20));
    follow(keyedWet.gain, settings.keyedWet);
    follow(compressor.threshold, settings.threshold);
    follow(compressor.ratio, settings.ratio);
    follow(compressor.knee, settings.knee);
    follow(compressor.attack, settings.attack);
    follow(compressor.release, settings.release);
    follow(trim.gain, 10 ** (settings.trimDb / 20));
    follow(dry.gain, settings.dry);
    follow(wet.gain, settings.nativeWet);
  };

  // A fresh node has its own defaults: set the first state outright, ramps come after.
  const first = compressorSettings(initial);
  compressor.threshold.value = first.threshold;
  compressor.ratio.value = first.ratio;
  compressor.knee.value = first.knee;
  compressor.attack.value = first.attack;
  compressor.release.value = first.release;
  trim.gain.value = 10 ** (first.trimDb / 20);
  dry.gain.value = first.dry;
  wet.gain.value = first.nativeWet;
  keyedTrim.gain.value = 10 ** (first.keyedTrimDb / 20);
  keyedWet.gain.value = first.keyedWet;

  let disposed = false;
  const ready = loadKeyDetector(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
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
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      detector?.disconnect();
      for (const node of [
        sidechain,
        keyed,
        keyedTrim,
        keyedWet,
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
      return current.external ? keyedReduction : compressor.reduction;
    },
    readings: (): DeviceReadings => ({
      gainReductionDb: current.external ? keyedReduction : compressor.reduction,
    }),
    ready,
    sidechain,
    update,
  };
}