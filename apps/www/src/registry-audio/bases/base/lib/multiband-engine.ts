import { toWebAudioQ } from "@audio-ui/core/analysis";
import type { DeviceBinding } from "@audio-ui/core/device";
import {
  KEY_DETECTOR_PARAMETERS,
  loadKeyDetector,
} from "@/registry-audio/bases/base/lib/key-detector";
import {
  BANDS,
  type Band,
  CROSSOVER_Q,
  type MultibandState,
  multibandSettings,
} from "@/registry-audio/bases/base/lib/multiband-device";

const RAMP_SECONDS = 0.01;

export interface MultibandEngine extends DeviceBinding<MultibandState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the detectors are in the graph. Until then the bands pass unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB each band is taken down by right now, 0 or negative. Read it per frame. */
  readonly reductions: Record<Band, number>;
}

/**
 * A multiband compressor on the Web Audio API for a `MultibandState`:
 *
 * ```
 * input → low-pass at the low split (x2) ──→ [low-pass + high-pass at the high split] → low gain ─┐
 *       → high-pass at the low split (x2) → low-pass at the high split (x2) → mid gain ───────────┼→ output gain → output
 *                                         → high-pass at the high split (x2) → high gain ────────┘
 * each band's signal → detector → the band's own gain
 * ```
 *
 * Two biquads in a row are one Linkwitz-Riley filter; the low band also goes
 * through the high split's two halves, added, so it is delayed in phase as
 * the others are and the three add back to a flat response. Each band has its
 * own detector, the one of the compressor's key. Until they are ready the
 * bands pass.
 */
export function createMultibandEngine(
  ctx: BaseAudioContext,
  initial: MultibandState
): MultibandEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const master = ctx.createGain();
  const pair = (type: BiquadFilterType, frequency: number) => {
    const filters = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
    for (const filter of filters) {
      filter.type = type;
      // The node takes the Q of a low-pass or high-pass in dB: this is the Butterworth one, -3 dB.
      filter.Q.value = toWebAudioQ("lowcut", CROSSOVER_Q);
      filter.frequency.value = frequency;
    }
    filters[0]?.connect(filters[1] as BiquadFilterNode);
    return filters as [BiquadFilterNode, BiquadFilterNode];
  };
  let settings = multibandSettings(initial);
  const lowSplit = pair("lowpass", settings.lowHz);
  const highOfLow = pair("highpass", settings.lowHz);
  const lowAllpassLow = pair("lowpass", settings.highHz);
  const lowAllpassHigh = pair("highpass", settings.highHz);
  const midSplit = pair("lowpass", settings.highHz);
  const highSplit = pair("highpass", settings.highHz);
  const gains = {
    high: ctx.createGain(),
    low: ctx.createGain(),
    mid: ctx.createGain(),
  };
  input.connect(lowSplit[0]);
  input.connect(highOfLow[0]);
  highOfLow[1].connect(midSplit[0]);
  highOfLow[1].connect(highSplit[0]);
  lowSplit[1].connect(lowAllpassLow[0]);
  lowSplit[1].connect(lowAllpassHigh[0]);
  lowAllpassLow[1].connect(gains.low);
  lowAllpassHigh[1].connect(gains.low);
  midSplit[1].connect(gains.mid);
  highSplit[1].connect(gains.high);
  for (const gain of Object.values(gains)) {
    gain.connect(master);
  }
  master.connect(output);
  master.gain.value = settings.output;

  // What each detector reads: the band's signal before its gain.
  const taps: Record<Band, AudioNode> = {
    high: highSplit[1],
    low: lowSplit[1],
    mid: midSplit[1],
  };
  const detectors: Partial<Record<Band, AudioWorkletNode>> = {};
  const reductions: Record<Band, number> = { high: 0, low: 0, mid: 0 };
  let disposed = false;
  const setDetectors = (time: number) => {
    BANDS.forEach((band, index) => {
      for (const name of KEY_DETECTOR_PARAMETERS) {
        detectors[band]?.parameters
          .get(name)
          ?.setValueAtTime(settings.bands[index]?.[name] ?? 0, time);
      }
    });
  };
  const ready = loadKeyDetector(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    for (const band of BANDS) {
      const detector = new AudioWorkletNode(ctx, "audioui-compressor-key", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      detector.port.onmessage = (event: MessageEvent<number>) => {
        reductions[band] = event.data;
      };
      detectors[band] = detector;
      taps[band].connect(detector);
      gains[band].gain.value = 0;
      detector.connect(gains[band].gain);
    }
    setDetectors(0);
    return true;
  });

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      disposed = true;
      for (const detector of Object.values(detectors)) {
        detector?.disconnect();
      }
      const filters = [
        lowSplit,
        highOfLow,
        lowAllpassLow,
        lowAllpassHigh,
        midSplit,
        highSplit,
      ].flat();
      for (const node of [
        input,
        master,
        output,
        ...Object.values(gains),
        ...filters,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    ready,
    reductions,
    update: (state) => {
      settings = multibandSettings(state);
      for (const filter of [...lowSplit, ...highOfLow]) {
        follow(filter.frequency, settings.lowHz);
      }
      for (const filter of [
        ...lowAllpassLow,
        ...lowAllpassHigh,
        ...midSplit,
        ...highSplit,
      ]) {
        follow(filter.frequency, settings.highHz);
      }
      follow(master.gain, settings.output);
      setDetectors(ctx.currentTime);
    },
  };
}
