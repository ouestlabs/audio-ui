import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { MID_SIDE_KERNELS } from "@/components/audio-ui/devices/mid-side/kernels";

/** The high-pass that stands for "no bass mono": under the range of hearing, so it passes the whole spectrum. */
const PASS_HZ = 10;

/**
 * A mid/side device: the stereo signal can first be widened, by a Haas delay
 * or by detuning its sides apart, then it is split into what the two channels
 * share (the mid) and what sets them apart (the side), each has its own level,
 * and the side can lose its lows so the bass stays in the centre, with no panel
 * and no audio in it.
 */
export const midSideDevice = defineDevice({
  description:
    "Sets the centre and the sides of a stereo signal apart: the mid is what both channels share and the side is what sets them apart, each with its own level in dB. Widen makes sides first, even from a mono sound: Haas delays the right channel a few milliseconds, Detune shifts the left up and the right down a few cents. Bass mono takes the lows out of the side, so everything under that frequency sits in the centre.",
  id: "audioui.mid-side",
  name: "Mid/side",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "off",
      id: "widen",
      kind: "choice",
      label: "Widen",
      options: [
        { label: "Off", value: "off" },
        { label: "Haas", value: "haas" },
        { label: "Detune", value: "detune" },
      ],
    },
    {
      default: 0,
      id: "midDb",
      label: "Mid",
      max: 12,
      min: -24,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 0,
      id: "sideDb",
      label: "Side",
      max: 12,
      min: -24,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 0,
      format: (hz: number) => (hz <= PASS_HZ ? "Off" : formatHz(hz)),
      id: "bassMonoHz",
      label: "Bass mono",
      max: 500,
      min: 0,
      step: 5,
    },
    {
      default: 20,
      id: "haasMs",
      label: "Delay",
      max: 35,
      min: 1,
      step: 0.5,
      unit: "ms",
    },
    {
      default: 9,
      id: "detuneCents",
      label: "Detune",
      max: 50,
      min: 1,
      step: 1,
      unit: "ct",
    },
    {
      default: 50,
      id: "detuneMix",
      label: "Blend",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type MidSideState = DeviceState<typeof midSideDevice.parameters>;

/**
 * The numbers that go on the nodes for a state. Off, nothing is widened, both
 * levels are unity and the side keeps its lows.
 */
export function midSideSettings(state: MidSideState) {
  const on = state.enabled;
  return {
    bassHz: on ? Math.max(PASS_HZ, state.bassMonoHz) : PASS_HZ,
    detuneCents: state.detuneCents,
    detuneMix: state.detuneMix / 100,
    haas: state.haasMs / 1000,
    mid: on ? 10 ** (state.midDb / 20) : 1,
    side: on ? 10 ** (state.sideDb / 20) : 1,
    widen: on ? state.widen : "off",
  };
}

/**
 * The source of the detune's `AudioWorklet`, processor `audioui-detune`: the
 * shifters of `@audio/spatial-microshift`, two read heads that glide through a
 * 50 ms ring and cross-fade, the left shifted up and the right down, each
 * blended with its channel as the package does. Its parameters are the cents
 * and the blend. A new detune waits for the knob to rest, then fades in on a
 * fresh pair, run through the last 50 ms of sound first so it sounds at once.
 * With nothing coming in it plays out the ring.
 */
export const DETUNE_WORKLET = `${MID_SIDE_KERNELS}
const REST_SECONDS = 0.12;
const FADE_SECONDS = 0.08;
/** The package's ring: 50 ms, as far as a head reads behind. */
const RING = Math.max(256, Math.round(sampleRate * 0.05));
/** With nothing coming in, the heads play out the ring until it has been this long quiet. */
const QUIET_SECONDS = 0.1;
const SILENT = 1e-6;

/** A shifter up for the left and one down for the right, at \`cents\`, run through \`history\` (oldest at \`at\`) first. */
function pairOf(cents, history, at) {
  const pair = { cents, down: shifter(-cents, RING), up: shifter(cents, RING) };
  if (history) {
    for (let step = 0; step < RING; step += 1) {
      const index = (at + step) % RING;
      pair.up(history[0][index]);
      pair.down(history[1][index]);
    }
  }
  return pair;
}

class AudioUiDetune extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "cents", defaultValue: 9, minValue: 1, maxValue: 50, automationRate: "k-rate" },
      { name: "mix", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.pair = null;
    this.leaving = null;
    this.target = 0;
    this.resting = 0;
    this.quiet = 0;
    this.history = [new Float32Array(RING), new Float32Array(RING)];
    this.at = 0;
    this.silence = new Float32Array(0);
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(output && output.length > 0)) {
      return true;
    }
    const frames = output[0].length;
    const coming = input && input.length > 0;
    if (!coming && this.quiet >= QUIET_SECONDS * sampleRate) {
      return true;
    }
    if (this.silence.length < frames) {
      this.silence = new Float32Array(frames);
    }
    // Nothing coming in: the heads still play out the ring, fed silence.
    const left = coming ? input[0] : this.silence;
    const right = coming ? (input[1] ?? input[0]) : this.silence;
    const cents = parameters.cents[0];
    const mix = parameters.mix[0];
    if (!this.pair) {
      this.pair = pairOf(cents, null, 0);
    }
    // A new detune, once the knob has stood still long enough.
    this.resting = cents === this.target ? this.resting + frames : 0;
    this.target = cents;
    if (!this.leaving && cents !== this.pair.cents && this.resting >= REST_SECONDS * sampleRate) {
      const fade = Math.round(FADE_SECONDS * sampleRate);
      this.leaving = { left: fade, pair: this.pair, total: fade };
      this.pair = pairOf(cents, this.history, this.at);
    }
    const outLeft = output[0];
    const outRight = output[1] ?? output[0];
    let loudest = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      const l = left[frame];
      const r = right[frame];
      let up = this.pair.up(l);
      let down = this.pair.down(r);
      if (this.leaving) {
        // An equal-power fade of the shifted sound alone: the blend of the dry is the same in both.
        const share = (Math.max(0, this.leaving.left - frame) / this.leaving.total) * Math.PI / 2;
        up = up * Math.cos(share) + this.leaving.pair.up(l) * Math.sin(share);
        down = down * Math.cos(share) + this.leaving.pair.down(r) * Math.sin(share);
      }
      outLeft[frame] = l * (1 - mix) + up * mix;
      if (outRight !== outLeft) {
        outRight[frame] = r * (1 - mix) + down * mix;
      }
      loudest = Math.max(loudest, Math.abs(outLeft[frame]), Math.abs(outRight[frame]));
      this.history[0][this.at] = l;
      this.history[1][this.at] = r;
      this.at = (this.at + 1) % RING;
    }
    if (this.leaving) {
      this.leaving.left -= frames;
      if (this.leaving.left <= 0) {
        this.leaving = null;
      }
    }
    this.quiet = coming || loudest > SILENT ? 0 : this.quiet + frames;
    return true;
  }
}
registerProcessor("audioui-detune", AudioUiDetune);
`;