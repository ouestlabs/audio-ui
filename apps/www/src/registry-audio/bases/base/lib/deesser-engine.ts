import { toWebAudioQ } from "@audio-ui/core/analysis";
import type { DeviceBinding, DeviceReadings } from "@audio-ui/core/device";
import {
  CROSSOVER_Q,
  type DeesserState,
  deesserSettings,
  deesserTable,
} from "@/registry-audio/bases/base/lib/deesser-device";
import {
  KEY_DETECTOR_PARAMETERS,
  loadKeyDetector,
} from "@/registry-audio/bases/base/lib/key-detector";

const RAMP_SECONDS = 0.01;

export interface DeesserEngine extends DeviceBinding<DeesserState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** What the highs are taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the detector is in the graph. Until then the highs pass unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB the highs are taken down by right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
}

/**
 * A de-esser on the Web Audio API for a `DeesserState`:
 *
 * ```
 * input → low-pass ×2 → lows ────────────────────────────────┐
 *       → high-pass ×2 → highs gain → output                  ├→ output
 *                      ↘ detector → floor → the highs' gain ──┘
 * ```
 *
 * Two biquads in a row make each half of a Linkwitz-Riley split, which add
 * back to a flat response with no detector. The detector is the one of the
 * compressor's key: it reads the highs and writes the gain they get, and a
 * table keeps it from going under the range. Until it is ready the highs pass.
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
  input.connect(lowA).connect(lowB).connect(lows).connect(output);
  input.connect(highA).connect(highB).connect(highs).connect(output);

  let settings = deesserSettings(initial);
  let { floor } = settings;
  clamp.curve = deesserTable(floor);
  for (const filter of [lowA, lowB, highA, highB]) {
    filter.frequency.value = settings.frequency;
  }
  lows.gain.value = settings.lowGain;
  highs.gain.value = 1;

  let detector: AudioWorkletNode | null = null;
  let reduction = 0;
  let disposed = false;
  const setDetector = (time: number) => {
    for (const name of KEY_DETECTOR_PARAMETERS) {
      detector?.parameters.get(name)?.setValueAtTime(settings[name], time);
    }
  };
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
      reduction = event.data;
    };
    setDetector(0);
    highB.connect(detector);
    detector.connect(clamp).connect(highs.gain);
    highs.gain.value = 0;
    return true;
  });

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      disposed = true;
      detector?.disconnect();
      for (const node of [
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
      return reduction;
    },
    readings: (): DeviceReadings => ({ gainReductionDb: reduction }),
    ready,
    update: (state) => {
      settings = deesserSettings(state);
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
