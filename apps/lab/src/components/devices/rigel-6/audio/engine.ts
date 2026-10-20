/**
 * The sound of Rigel-6: a mixing desk. Each of six channels runs a loop
 * through a low shelf and a high shelf (the EQ), a panner, a gate that mute
 * and solo close, then its fader, into one sum that goes to the bus. An
 * analyser sits after each fader for the channel's meter.
 *
 * The controls speak in the panel's own units (dB on the faders, -10 to 10 on
 * the pans, -12 to +12 dB on the EQ); each one is mapped here to the unit the
 * node takes. Everything moves with ramps, and the desk plays into the bus it
 * is attached to, which owns the master level and the safety limiter.
 */

export const CHANNELS = [
  "kick",
  "snare",
  "hats",
  "bass",
  "keys",
  "lead",
] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Strip {
  fader: number;
  hi: number;
  lo: number;
  mute: boolean;
  pan: number;
  solo: boolean;
}
export type Desk = Record<Channel, Strip>;
export type Knob = "hi" | "lo" | "pan";

/** The quietest the faders go: where the sound stops. */
export const FADER_MIN = -60;
export const FADER_MAX = 6;

export const DEFAULT_DESK: Desk = {
  bass: { fader: -6, hi: 0, lo: 0, mute: false, pan: 0, solo: false },
  hats: { fader: -12, hi: 0, lo: 0, mute: false, pan: 3, solo: false },
  keys: { fader: -9, hi: 0, lo: 0, mute: false, pan: -3, solo: false },
  kick: { fader: -6, hi: 0, lo: 0, mute: false, pan: 0, solo: false },
  lead: { fader: -14, hi: 0, lo: 0, mute: false, pan: 4, solo: false },
  snare: { fader: -9, hi: 0, lo: 0, mute: false, pan: -1, solo: false },
};

const LOW_SHELF = 120;
const HIGH_SHELF = 8000;
const RAMP = 0.02;
/** Headroom: six channels at 0 dB together still leave the bus's limiter room. */
const SUM_GAIN = 0.6;

const faderGain = (db: number) => (db <= FADER_MIN ? 0 : 10 ** (db / 20));

interface Nodes {
  analyser: AnalyserNode;
  fader: GainNode;
  gate: GainNode;
  high: BiquadFilterNode;
  input: GainNode;
  low: BiquadFilterNode;
  panner: StereoPannerNode;
}

export function createRigelEngine() {
  const desk: Desk = structuredClone(DEFAULT_DESK);
  const buffers = new Map<Channel, AudioBuffer>();
  const sources = new Set<AudioBufferSourceNode>();
  let graph: {
    ctx: BaseAudioContext;
    nodes: Record<Channel, Nodes>;
    sum: GainNode;
  } | null = null;

  /** A channel is heard unless it is muted, or another one is soloed and it is not. */
  function audible(channel: Channel) {
    const anySolo = CHANNELS.some((name) => desk[name].solo);
    return !desk[channel].mute && (!anySolo || desk[channel].solo);
  }

  /** Writes the desk's gates, after a mute or a solo moved. */
  function gates() {
    if (!graph) {
      return;
    }
    const now = graph.ctx.currentTime;
    for (const channel of CHANNELS) {
      graph.nodes[channel].gate.gain.setTargetAtTime(
        audible(channel) ? 1 : 0,
        now,
        RAMP / 2
      );
    }
  }

  return {
    /** The analyser after a channel's fader, for its meter; `null` until attached. */
    analyser: (channel: Channel) => graph?.nodes[channel].analyser ?? null,
    /** Builds the six channels into `destination` (the bus): nothing sounds until a loop plays. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const sum = ctx.createGain();
      sum.gain.value = SUM_GAIN;
      sum.connect(destination);
      const nodes = {} as Record<Channel, Nodes>;
      for (const channel of CHANNELS) {
        const strip = desk[channel];
        const input = ctx.createGain();
        const low = ctx.createBiquadFilter();
        low.type = "lowshelf";
        low.frequency.value = LOW_SHELF;
        low.gain.value = strip.lo;
        const high = ctx.createBiquadFilter();
        high.type = "highshelf";
        high.frequency.value = HIGH_SHELF;
        high.gain.value = strip.hi;
        const panner = ctx.createStereoPanner();
        panner.pan.value = strip.pan / 10;
        const gate = ctx.createGain();
        gate.gain.value = audible(channel) ? 1 : 0;
        const fader = ctx.createGain();
        fader.gain.value = faderGain(strip.fader);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        input
          .connect(low)
          .connect(high)
          .connect(panner)
          .connect(gate)
          .connect(fader)
          .connect(sum);
        fader.connect(analyser);
        nodes[channel] = { analyser, fader, gate, high, input, low, panner };
      }
      graph = { ctx, nodes, sum };
    },
    /** Stops the loops and disconnects everything this engine made; the shared context stays. */
    detach() {
      for (const source of sources) {
        source.stop();
      }
      sources.clear();
      graph?.sum.disconnect();
      graph = null;
    },
    /** Sets the loop each channel plays. */
    load(next: Partial<Record<Channel, AudioBuffer>>) {
      for (const channel of CHANNELS) {
        const buffer = next[channel];
        if (buffer) {
          buffers.set(channel, buffer);
        }
      }
    },
    /** Starts every loop on the same instant of the audio clock, so they stay together. */
    play() {
      if (!graph) {
        return;
      }
      const when = graph.ctx.currentTime + 0.05;
      for (const channel of CHANNELS) {
        const buffer = buffers.get(channel);
        if (!buffer) {
          continue;
        }
        const source = graph.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(graph.nodes[channel].input);
        source.start(when);
        source.onended = () => {
          sources.delete(source);
          source.disconnect();
        };
        sources.add(source);
      }
    },
    set<K extends keyof Strip>(channel: Channel, key: K, value: Strip[K]) {
      desk[channel][key] = value;
      if (!graph) {
        return;
      }
      const now = graph.ctx.currentTime;
      const nodes = graph.nodes[channel];
      if (key === "fader") {
        nodes.fader.gain.setTargetAtTime(faderGain(value as number), now, RAMP);
      }
      if (key === "pan") {
        nodes.panner.pan.setTargetAtTime((value as number) / 10, now, RAMP);
      }
      if (key === "lo") {
        nodes.low.gain.setTargetAtTime(value as number, now, RAMP);
      }
      if (key === "hi") {
        nodes.high.gain.setTargetAtTime(value as number, now, RAMP);
      }
      if (key === "mute" || key === "solo") {
        gates();
      }
    },
    stop() {
      for (const source of [...sources]) {
        source.stop();
      }
    },
  };
}

export type RigelEngine = ReturnType<typeof createRigelEngine>;
