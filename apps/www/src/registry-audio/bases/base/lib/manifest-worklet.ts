/**
 * The source of an `AudioWorklet` processor that plays one of several audio.js
 * manifests: the `audio.js` of an `@audio/*` package, a processor made from
 * its parameters, which flags `restart` the ones it is made with. The devices
 * that play an audio.js package as one of their models share it.
 *
 * `kernels` holds the manifests, as a device's `kernels.ts` vendors them, and
 * `models` names each one by the value that picks it (`{ smooth: "compressor" }`).
 * The processor, registered as `processor`, has a k-rate parameter for each
 * parameter of any of its manifests, by the manifest's name, a toggle as 0 or
 * 1, and takes the values as they come, past the ranges a manifest suggests.
 * It plays the model sent by message (`{ model }`), the first one from
 * `processorOptions.model`, per channel, two channels out.
 *
 * - A parameter the manifest reads as it plays changes at once. A new model,
 *   or a change to a parameter flagged `restart`, makes a new one, at most
 *   every 50 ms, so a knob turned all along is heard as it goes. The new one
 *   hears the last 100 ms first, so it starts where the old one was, and
 *   takes over in a 30 ms fade in a line, the two holding the same sound.
 * - With nothing coming in, it plays on silence as long as the manifest's
 *   `tail`, a second at least, so its state comes back to rest, then rests.
 * - It posts the gain it takes off, in dB, about every 10 ms, for a meter:
 *   what comes out against what went in, as late as the manifest's
 *   `latency` says it comes out.
 */
export function manifestWorklet({
  kernels,
  models,
  processor,
}: {
  kernels: string;
  models: Readonly<Record<string, string>>;
  processor: string;
}) {
  const entries = Object.entries(models)
    .map(([value, manifest]) => `${JSON.stringify(value)}: ${manifest}`)
    .join(", ");
  return `${kernels}
const MODELS = { ${entries} };
const RESTART_SECONDS = 0.05;
const FADE_SECONDS = 0.03;
const PREROLL_SECONDS = 0.1;
const QUIET_SECONDS = 1;
const POST_SECONDS = 0.01;
const BLOCK = 128;
/** The parameters that make each model again when they change. */
const RESTARTS = {};
/** A parameter for each one of any model, at the default of the first that has it. */
const DESCRIPTORS = [];
for (const name in MODELS) {
  const params = MODELS[name].params;
  RESTARTS[name] = Object.keys(params).filter((key) => (params[key].flags || []).includes("restart"));
  for (const key in params) {
    if (!DESCRIPTORS.some((descriptor) => descriptor.name === key)) {
      DESCRIPTORS.push({ name: key, defaultValue: Number(params[key].default), automationRate: "k-rate" });
    }
  }
}

class ManifestProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return DESCRIPTORS;
  }
  constructor(options) {
    super();
    this.model = options.processorOptions.model;
    this.port.onmessage = (event) => {
      if (MODELS[event.data.model]) {
        this.model = event.data.model;
      }
    };
    const length = Math.ceil(PREROLL_SECONDS * sampleRate);
    this.history = [new Float32Array(length), new Float32Array(length)];
    this.filled = 0;
    this.values = {};
    this.playing = null;
    this.leaving = null;
    this.since = 0;
    this.quiet = 0;
    this.sent = 0;
    this.taken = 0;
    this.given = 0;
    this.scratch = [];
  }
  /** A model's values for this block, from the parameters, a toggle as a boolean. One object per model, changed in place. */
  valuesOf(name, parameters) {
    const params = MODELS[name].params;
    if (!this.values[name]) {
      this.values[name] = {};
      for (const key in params) {
        this.values[name][key] = params[key].type === "bool" ? false : new Float32Array(1);
      }
    }
    const values = this.values[name];
    for (const key in params) {
      const value = parameters[key][0];
      if (params[key].type === "bool") {
        values[key] = value >= 0.5;
      } else {
        values[key][0] = value;
      }
    }
    return values;
  }
  /** A new model, played first on the sound just gone. */
  start(name, values, key) {
    const context = { currentTime, maxBlockSize: BLOCK, maxChannels: 2, params: values, sampleRate };
    const run = MODELS[name](context);
    const late = MODELS[name].latency ? MODELS[name].latency(context) : 0;
    const [left, right] = this.history;
    const out = [this.scratch[2], this.scratch[3]];
    for (let at = left.length - this.filled; at < left.length; at += BLOCK) {
      const end = Math.min(at + BLOCK, left.length);
      run([[left.subarray(at, end), right.subarray(at, end)]], [out], values);
    }
    this.since = 0;
    return { key, late: Math.min(late, left.length), run, values };
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const name = this.model;
    if (!(output && output.length > 0 && MODELS[name])) {
      return true;
    }
    const frames = output[0].length;
    const coming = input && input.length > 0;
    if (!coming && this.quiet >= Math.max(MODELS[name].tail || 0, QUIET_SECONDS) * sampleRate) {
      return true;
    }
    if (!this.scratch[0] || this.scratch[0].length < Math.max(frames, BLOCK)) {
      const size = Math.max(frames, BLOCK);
      this.scratch = [0, 1, 2, 3, 4].map(() => new Float32Array(size));
    }
    // Nothing coming in: the model still plays on, fed silence, so its state comes back to rest.
    const silence = this.scratch[4].subarray(0, frames);
    const left = coming ? input[0] : silence;
    const right = coming ? (input[1] ?? input[0]) : silence;
    const out = output.length > 1 ? output : [output[0], this.scratch[0].subarray(0, frames)];
    const values = this.valuesOf(name, parameters);
    let key = name;
    for (const restart of RESTARTS[name]) {
      key += ":" + (typeof values[restart] === "boolean" ? values[restart] : values[restart][0]);
    }
    this.since += frames;
    if (!this.playing) {
      this.playing = this.start(name, values, key);
    } else if (key !== this.playing.key && !this.leaving && this.since >= RESTART_SECONDS * sampleRate) {
      const fade = Math.round(FADE_SECONDS * sampleRate);
      this.leaving = { left: fade, model: this.playing, total: fade };
      this.playing = this.start(name, values, key);
    }
    this.playing.run([[left, right]], [out], values);
    if (this.leaving) {
      const old = [this.scratch[1].subarray(0, frames), this.scratch[2].subarray(0, frames)];
      this.leaving.model.run([[left, right]], [old], this.leaving.model.values);
      for (let frame = 0; frame < frames; frame += 1) {
        // A fade in a line: the two hold the same sound at about the same gain, so their amplitudes add.
        const going = Math.max(0, this.leaving.left - frame) / this.leaving.total;
        out[0][frame] = out[0][frame] * (1 - going) + old[0][frame] * going;
        out[1][frame] = out[1][frame] * (1 - going) + old[1][frame] * going;
      }
      this.leaving.left -= frames;
      if (this.leaving.left <= 0) {
        this.leaving = null;
      }
    }
    // What went in as late as it comes out, against what comes out.
    const late = this.playing.late;
    const held = this.history[0].length;
    for (let frame = 0; frame < frames; frame += 1) {
      const back = frame - late;
      const inLeft = back < 0 ? this.history[0][held + back] : left[back];
      const inRight = back < 0 ? this.history[1][held + back] : right[back];
      this.taken += Math.abs(inLeft) + Math.abs(inRight);
      this.given += Math.abs(out[0][frame]) + Math.abs(out[1][frame]);
    }
    const sources = [left, right];
    for (let channel = 0; channel < 2; channel += 1) {
      const line = this.history[channel];
      line.copyWithin(0, frames);
      line.set(sources[channel], line.length - frames);
    }
    this.filled = Math.min(held, this.filled + frames);
    this.sent += frames;
    if (this.sent >= POST_SECONDS * sampleRate) {
      this.port.postMessage(this.taken > 1e-9 ? Math.min(0, 20 * Math.log10(this.given / this.taken + 1e-12)) : 0);
      this.sent = 0;
      this.taken = 0;
      this.given = 0;
    }
    this.quiet = coming ? 0 : this.quiet + frames;
    return true;
  }
}
registerProcessor(${JSON.stringify(processor)}, ManifestProcessor);
`;
}
