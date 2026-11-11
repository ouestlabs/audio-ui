import { loadWorklet } from "@audio-ui/engine/worklet";
/**
 * The processor of the key, as the source of an `AudioWorklet`. It reads the
 * key and writes the gain to apply, one value per sample: the level of the key
 * (a peak follower: instant up, 10 ms down, so a low note does not ripple the
 * reduction) in dB goes through the same curve as the node's (a soft knee around the
 * threshold, a slope of 1/ratio over it), and the reduction is smoothed with
 * the attack going down and the release coming back. It posts the reduction
 * about every 10 ms, for a meter. The engine loads it from a blob, so there is
 * no file to serve.
 */
export const KEY_DETECTOR_WORKLET = `
class AudioUiCompressorKey extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -18, minValue: -100, maxValue: 0, automationRate: "k-rate" },
      { name: "ratio", defaultValue: 4, minValue: 1, maxValue: 20, automationRate: "k-rate" },
      { name: "knee", defaultValue: 6, minValue: 0, maxValue: 40, automationRate: "k-rate" },
      { name: "attack", defaultValue: 0.005, minValue: 0.00005, maxValue: 1, automationRate: "k-rate" },
      { name: "release", defaultValue: 0.08, minValue: 0.001, maxValue: 10, automationRate: "k-rate" }
    ];
  }
  constructor() {
    super();
    this.reduction = 0;
    this.level = 0;
    this.sent = 0;
  }
  process(inputs, outputs, parameters) {
    const key = inputs[0];
    const out = outputs[0][0];
    if (!out) return true;
    const threshold = parameters.threshold[0];
    const ratio = parameters.ratio[0];
    const knee = parameters.knee[0];
    const attack = 1 - Math.exp(-1 / (parameters.attack[0] * sampleRate));
    const release = 1 - Math.exp(-1 / (parameters.release[0] * sampleRate));
    const fall = Math.exp(-1 / (0.01 * sampleRate));
    for (let n = 0; n < out.length; n += 1) {
      let peak = 0;
      for (let c = 0; c < key.length; c += 1) {
        const v = Math.abs(key[c][n]);
        if (v > peak) peak = v;
      }
      this.level = peak > this.level ? peak : this.level * fall;
      const level = 20 * Math.log10(this.level + 1e-9);
      const over = level - threshold;
      let target = 0;
      if (2 * over > knee) target = (1 / ratio - 1) * over;
      else if (2 * over > -knee) target = (1 / ratio - 1) * ((over + knee / 2) ** 2) / (2 * knee);
      this.reduction += (target - this.reduction) * (target < this.reduction ? attack : release);
      out[n] = 10 ** (this.reduction / 20);
    }
    this.sent += out.length;
    if (this.sent >= sampleRate / 100) {
      this.sent = 0;
      this.port.postMessage(this.reduction);
    }
    return true;
  }
}
registerProcessor("audioui-compressor-key", AudioUiCompressorKey);
`;

/** The parameters of the detector, by name: each is set with `setValueAtTime` on the node's `parameters`. */
export const KEY_DETECTOR_PARAMETERS = [
  "attack",
  "knee",
  "ratio",
  "release",
  "threshold",
] as const;

/**
 * Loads the detector of the key into a context once: an `AudioWorklet`
 * registered as `audioui-compressor-key`, which reads a signal and writes the
 * gain a compressor would apply to it. `false` when the context cannot run
 * worklets.
 */
export function loadKeyDetector(ctx: BaseAudioContext): Promise<boolean> {
  return loadWorklet(ctx, KEY_DETECTOR_WORKLET);
}
