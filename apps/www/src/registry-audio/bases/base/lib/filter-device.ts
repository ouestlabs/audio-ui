import diodeLadder from "@audio/filter-diode-ladder";
import korg35 from "@audio/filter-korg35";
import moogLadder from "@audio/filter-moog-ladder";
import {
  type BiquadType,
  biquadResponse,
  formatDb,
  formatHz,
  SAMPLE_RATE,
  toWebAudioQ,
  WEB_AUDIO_FILTER_TYPES,
} from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { LADDER_KERNELS } from "@/registry-audio/bases/base/lib/filter-ladders";

/** The width a filter has when the resonance is at its lowest: flat, a Butterworth. */
export const FLAT_Q = Math.SQRT1_2;
/** The highest resonance, as a width. */
const MAX_Q = 18;

/**
 * A filter as a device: a type, a circuit, a cutoff, a resonance and a drive,
 * with no panel and no audio in it. A panel draws its state, an engine plays
 * it, an agent drives it through `deviceTools(filterDevice)`.
 */
export const filterDevice = defineDevice({
  description:
    "Takes part of the spectrum out: a low-pass, high-pass, band-pass or notch filter at a cutoff frequency, with a resonance that makes it ring or narrow it, through a circuit, clean or a ladder that a drive bends.",
  id: "audioui.filter",
  name: "Filter",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "lowpass",
      id: "type",
      kind: "choice",
      label: "Type",
      options: [
        { label: "Low-pass", value: "lowpass" },
        { label: "High-pass", value: "highpass" },
        { label: "Band-pass", value: "bandpass" },
        { label: "Notch", value: "notch" },
      ],
    },
    {
      default: "clean",
      id: "circuit",
      kind: "choice",
      label: "Circuit",
      options: [
        { label: "Clean", value: "clean" },
        { label: "Ladder 24", value: "ladder24" },
        { label: "Ladder 12", value: "ladder12" },
        { label: "Diode", value: "diode" },
        { label: "Korg35", value: "korg35" },
      ],
    },
    {
      default: 1200,
      format: formatHz,
      id: "cutoffHz",
      label: "Cutoff",
      max: 20_000,
      min: 20,
      scale: "log",
      step: 1,
    },
    {
      default: FLAT_Q,
      format: (q: number) => q.toFixed(2),
      id: "resonance",
      label: "Resonance",
      max: MAX_Q,
      min: 0.3,
      scale: "log",
      step: 0.01,
    },
    {
      default: 0,
      format: formatDb,
      id: "driveDb",
      label: "Drive",
      max: 20,
      min: -20,
      step: 0.5,
    },
  ],
});

export type FilterState = DeviceState<typeof filterDevice.parameters>;
export type FilterCircuit = FilterState["circuit"];
type FilterType = FilterState["type"];
type LadderCircuit = Exclude<FilterCircuit, "clean">;

/** The types each circuit has: the clean filter all four, a ladder the taps of its own. */
export const CIRCUIT_TYPES: Record<FilterCircuit, readonly FilterType[]> = {
  clean: ["lowpass", "highpass", "bandpass", "notch"],
  diode: ["lowpass"],
  korg35: ["lowpass", "highpass"],
  ladder12: ["lowpass", "highpass", "bandpass"],
  ladder24: ["lowpass", "highpass", "bandpass"],
};

/** The circuit a state plays: its own where it has the type, the clean filter where it does not. */
export function filterCircuit(
  state: Pick<FilterState, "circuit" | "type">
): FilterCircuit {
  return CIRCUIT_TYPES[state.circuit].includes(state.type)
    ? state.circuit
    : "clean";
}

/** How far the clean filter's peak rises over its passband at a resonance, in dB: none at flat or under. */
const peakDb = (q: number) =>
  q <= FLAT_Q ? 0 : 20 * Math.log10(q / Math.sqrt(1 - 1 / (4 * q * q)));

/** Between two steps of the peak tables, in dB. */
const PEAK_STEP_DB = 2;
/** The resonance each ladder needs for its peak to rise 0, 2, 4… 26 dB over its passband: measured on each, the same at any cutoff. */
const LADDER_PEAKS: Record<
  Exclude<LadderCircuit, "korg35">,
  readonly number[]
> = {
  diode: [
    0, 0.2749, 0.3892, 0.4937, 0.5901, 0.6776, 0.7558, 0.8245, 0.8838, 0.9342,
    0.9766, 1.0119, 1.041, 1.0648,
  ],
  ladder12: [
    0, 0.1248, 0.1973, 0.2702, 0.3436, 0.4166, 0.4876, 0.5553, 0.6185, 0.6761,
    0.7278, 0.7732, 0.8126, 0.8461,
  ],
  ladder24: [
    0, 0.2344, 0.3341, 0.4248, 0.5081, 0.5837, 0.6511, 0.7101, 0.761, 0.8042,
    0.8406, 0.8708, 0.8956, 0.916,
  ],
};

/**
 * A ladder's resonance for a resonance of the clean filter: its peak as high
 * over its passband. The Korg35 has no peak to match: its resonance follows the
 * knob, from none at flat to all of it at the top.
 */
export function ladderResonance(circuit: LadderCircuit, q: number): number {
  if (circuit === "korg35") {
    return Math.min(
      1,
      Math.max(0, Math.log(q / FLAT_Q) / Math.log(MAX_Q / FLAT_Q))
    );
  }
  const table = LADDER_PEAKS[circuit];
  const at = Math.min(table.length - 1, peakDb(q) / PEAK_STEP_DB);
  const below = Math.floor(at);
  const low = table[below] ?? 0;
  const high = table[Math.min(table.length - 1, below + 1)] ?? low;
  return low + (high - low) * (at - below);
}

/**
 * The numbers that go on the ladder worklet for a state: the circuit it plays,
 * its tap, the cutoff, the resonance and the drive as a gain. `null` when the
 * state plays the clean filter.
 */
export function ladderSettings(state: FilterState) {
  const circuit = filterCircuit(state);
  if (circuit === "clean") {
    return null;
  }
  return {
    circuit,
    cutoff: state.cutoffHz,
    drive: 10 ** (state.driveDb / 20),
    resonance: ladderResonance(circuit, state.resonance),
    type:
      state.type === "highpass" || state.type === "bandpass"
        ? state.type
        : "lowpass",
  } as const;
}

type LadderSettings = NonNullable<ReturnType<typeof ladderSettings>>;

/**
 * How much a ladder's low-pass is brought back up so its passband stays at
 * 0 dB as the resonance rises, where the circuit loses its lows: by its loss
 * at DC, `1 + 4·resonance` for the Moog and diode ladders, `1 + k(1 + G + G²)`
 * for the Korg35, its feedback `k = 2·resonance` and `G` its stages' gain at
 * the cutoff. Its peak then rises over 0 dB as the clean filter's does. A
 * high-pass loses nothing in its passband and a band-pass has none: 1.
 */
export function passbandMakeup(
  { circuit, cutoff, resonance, type }: LadderSettings,
  sampleRate: number
): number {
  if (type !== "lowpass") {
    return 1;
  }
  if (circuit !== "korg35") {
    return 1 + 4 * resonance;
  }
  const g = Math.tan(
    (Math.PI * Math.min(cutoff, sampleRate * 0.49)) / sampleRate
  );
  const stage = g / (1 + g);
  return 1 + 2 * resonance * (1 + stage + stage * stage);
}
type Kernel = (
  data: Float32Array,
  params: {
    fc: number;
    fs: number;
    resonance: number;
    type: LadderSettings["type"];
  }
) => unknown;

/** Each ladder as its package runs it, on the main thread, for its curve. */
const KERNELS: Record<LadderCircuit, Kernel> = {
  diode: (data, params) => diodeLadder(data, params),
  korg35: (data, params) =>
    korg35(data, {
      ...params,
      type: params.type === "highpass" ? "highpass" : "lowpass",
    }),
  ladder12: (data, params) => moogLadder(data, { ...params, poles: 2 }),
  ladder24: (data, params) => moogLadder(data, { ...params, poles: 4 }),
};

/** How many frames of a ladder's response its curve reads at most: enough for a low cutoff ringing at the top resonance to die away. */
const RESPONSE_FRAMES = 2 ** 15;
/** A click too quiet to saturate a ladder: its curve is the circuit itself, whatever the drive. */
const CLICK = 1e-5;
/** Under this, a response has died away: what follows adds nothing to its transform. */
const SILENT = CLICK * 1e-7;

/** The gain of a response at a frequency: its transform there, the phasor turned one sample at a time. */
function gainAt(response: Float32Array, length: number, hz: number) {
  const step = (2 * Math.PI * hz) / SAMPLE_RATE;
  const cos = Math.cos(step);
  const sin = Math.sin(step);
  let re = 0;
  let im = 0;
  let turnRe = 1;
  let turnIm = 0;
  for (let frame = 0; frame < length; frame += 1) {
    const sample = response[frame] ?? 0;
    re += sample * turnRe;
    im += sample * turnIm;
    const next = turnRe * cos + turnIm * sin;
    turnIm = turnIm * cos - turnRe * sin;
    turnRe = next;
  }
  return Math.hypot(re, im);
}

/** A ladder's curve: its response to a quiet click, its passband brought back, read at each frequency asked, in dB. */
function ladderResponse(settings: LadderSettings) {
  const { circuit, cutoff, resonance, type } = settings;
  const response = new Float32Array(RESPONSE_FRAMES);
  response[0] = CLICK;
  KERNELS[circuit](response, { fc: cutoff, fs: SAMPLE_RATE, resonance, type });
  const makeup = 20 * Math.log10(passbandMakeup(settings, SAMPLE_RATE));
  let { length } = response;
  while (length > 1 && Math.abs(response[length - 1] ?? 0) < SILENT) {
    length -= 1;
  }
  // A curve is drawn twice, its area and its line, at the same frequencies.
  const read = new Map<number, number>();
  return (hz: number) => {
    let db = read.get(hz);
    if (db === undefined) {
      db =
        makeup +
        20 * Math.log10(Math.max(gainAt(response, length, hz) / CLICK, 1e-6));
      read.set(hz, db);
    }
    return db;
  };
}

/**
 * The ladder filters' processor for an `AudioWorklet`: the circuit and the
 * tap a message picks, at the cutoff, the resonance and the drive of its
 * parameters, 128 frames at a time, its state kept per channel. Its output
 * is brought back by `tanh(1) / tanh(drive)`, so at the default drive it is
 * the kernel's own and more drive bends a full-scale sound without raising its
 * peak, and a low-pass by `passbandMakeup`, so its passband stays at 0 dB.
 */
export const LADDER_WORKLET = `${LADDER_KERNELS}
const CIRCUITS = {
  diode: (data, params) => diodeLadder(data, params),
  korg35: (data, params) => korg35(data, params),
  ladder12: (data, params) => moogLadder(data, Object.assign(params, { poles: 2 })),
  ladder24: (data, params) => moogLadder(data, Object.assign(params, { poles: 4 })),
};
class AudioUiLadder extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "cutoff", defaultValue: 1000, minValue: 20, maxValue: 20000, automationRate: "k-rate" },
      { name: "resonance", defaultValue: 0, minValue: 0, maxValue: 1.2, automationRate: "k-rate" },
      { name: "drive", defaultValue: 1, minValue: 0.1, maxValue: 10, automationRate: "k-rate" },
    ];
  }
  constructor(options) {
    super();
    const { circuit, type } = options.processorOptions;
    this.circuit = circuit;
    this.type = type;
    this.channels = [];
    this.port.onmessage = ({ data }) => {
      // Another circuit starts from rest: its state means something else.
      if (data.circuit !== this.circuit) {
        this.channels = [];
      }
      this.circuit = data.circuit;
      this.type = data.type;
    };
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(input && input.length > 0 && output)) {
      return true;
    }
    const run = CIRCUITS[this.circuit];
    const drive = parameters.drive[0];
    const cutoff = parameters.cutoff[0];
    const resonance = parameters.resonance[0];
    // As passbandMakeup on the main thread: a low-pass's loss at DC made up.
    let passband = 1;
    if (this.type === "lowpass" && this.circuit === "korg35") {
      const g = Math.tan((Math.PI * Math.min(cutoff, sampleRate * 0.49)) / sampleRate);
      const stage = g / (1 + g);
      passband = 1 + 2 * resonance * (1 + stage + stage * stage);
    } else if (this.type === "lowpass") {
      passband = 1 + 4 * resonance;
    }
    const makeup = (passband * Math.tanh(1)) / Math.tanh(drive);
    for (let channel = 0; channel < output.length; channel += 1) {
      const data = output[channel];
      data.set(input[channel % input.length]);
      this.channels[channel] ??= { fs: sampleRate };
      const params = this.channels[channel];
      params.fc = cutoff;
      params.resonance = resonance;
      params.drive = drive;
      params.type = this.type;
      run(data, params);
      for (let frame = 0; frame < data.length; frame += 1) {
        data[frame] *= makeup;
      }
    }
    return true;
  }
}
registerProcessor("audioui-ladder", AudioUiLadder);
`;

/** The band type of the shared curve code that each filter type is. A low-pass cuts the highs, so it is a high cut. */
const BAND_TYPES: Record<FilterState["type"], BiquadType> = {
  bandpass: "bandpass",
  highpass: "lowcut",
  lowpass: "highcut",
  notch: "notch",
};

/**
 * The numbers that go on the node for a state, as plain values. Pure, so what
 * an engine sets can be read and tested without an `AudioContext`. `q` is in
 * the unit the node wants: a low-pass and a high-pass read it in decibels.
 */
export function filterSettings(state: FilterState) {
  const band = BAND_TYPES[state.type];
  return {
    dry: state.enabled ? 0 : 1,
    frequency: state.cutoffHz,
    q: toWebAudioQ(band, state.resonance),
    type: WEB_AUDIO_FILTER_TYPES[band],
    wet: state.enabled ? 1 : 0,
  };
}

/** The curve a state plays: the gain in dB at each frequency, a ladder's measured on it. Flat when it is off. */
export function filterCurve(state: FilterState) {
  if (!state.enabled) {
    return () => 0;
  }
  const ladder = ladderSettings(state);
  if (ladder) {
    return ladderResponse(ladder);
  }
  return biquadResponse({
    frequency: state.cutoffHz,
    q: state.resonance,
    type: BAND_TYPES[state.type],
  });
}

/** How much a resonance rings over a flat filter, in dB: where a handle sits on the vertical axis. */
export const resonanceDb = (resonance: number) =>
  20 * Math.log10(resonance / FLAT_Q);

/** The resonance for a height in dB over a flat filter: the inverse of `resonanceDb`. */
export const resonanceFromDb = (db: number) => FLAT_Q * 10 ** (db / 20);
