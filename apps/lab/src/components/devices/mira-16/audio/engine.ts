/**
 * The sound of Mira-16: eight analog drum voices and a bass voice. The drums
 * are built from oscillators and noise each time they are hit, with no samples. A kick is a sine that falls
 * in pitch, a snare a pair of tones and a burst of noise, the hats and the
 * cowbell the square waves of an analog circuit, stacked. The bass is one
 * sawtooth, always running, into a resonant low-pass filter that an envelope
 * opens on each note; an accented note opens it further and plays louder.
 *
 * The controls speak in the panel's 0 to 10. Every hit is scheduled on the
 * audio clock (`time`), so a pattern keeps its feel whatever the page is
 * doing, and each one disconnects itself when it has ended. The engine plays
 * into the bus it is attached to, which owns the master level and the safety
 * limiter.
 */

export const INSTRUMENTS = [
  "kick",
  "snare",
  "lowTom",
  "highTom",
  "clap",
  "closedHat",
  "openHat",
  "cowbell",
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];
export type Control = "decay" | "level" | "tone";
export type BassControl = "bassDecay" | "cutoff" | "envmod" | "reso";
export type BassSettings = Record<BassControl, number>;

export type Settings = Record<Control, number>;
export type Kit = Record<Instrument, Settings>;

export const DEFAULT_KIT: Kit = {
  clap: { decay: 4, level: 7, tone: 5 },
  closedHat: { decay: 3, level: 6, tone: 5 },
  cowbell: { decay: 4, level: 6, tone: 5 },
  highTom: { decay: 4, level: 7, tone: 5 },
  kick: { decay: 5, level: 9, tone: 4 },
  lowTom: { decay: 4, level: 7, tone: 5 },
  openHat: { decay: 4, level: 6, tone: 5 },
  snare: { decay: 4, level: 8, tone: 5 },
};

export const DEFAULT_BASS: BassSettings = {
  bassDecay: 4,
  cutoff: 4,
  envmod: 6,
  reso: 6,
};

/** The lowest note a bass pitch of 0 plays: C2. */
export const ROOT = 36;
export const SPAN = 24;
const BASS_LEVEL = 0.3;
const BASS_ACCENT = 0.5;
const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);
const cutoffHertz = (value: number) => 60 * 80 ** unit(value);

/** The six square waves of an analog hat or cymbal circuit, in hertz. */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800] as const;
/** Headroom: eight voices at full level together still leave the bus's limiter room. */
const MIX_GAIN = 0.4;
const SILENCE = 0.0001;
const ATTACK = 0.002;

/** A control's 0 to 10 as a gain: silent at 0, then a curve that sits close to how loud it sounds. */
function levelGain(level: number) {
  return level <= 0 ? 0 : 0.9 * (level / 10) ** 1.6;
}

/** Where a control's 0 to 10 lands between two values. */
const between = (control: number, low: number, high: number) =>
  low + (high - low) * (control / 10);

export function createMiraEngine() {
  const kit: Kit = structuredClone(DEFAULT_KIT);
  const bassSettings: BassSettings = { ...DEFAULT_BASS };
  let bass: {
    amp: GainNode;
    first: BiquadFilterNode;
    osc: OscillatorNode;
    second: BiquadFilterNode;
  } | null = null;
  let graph: {
    ctx: BaseAudioContext;
    mix: GainNode;
    noise: AudioBuffer;
    /** The stage the open hat still ringing goes through, so a closed hat can shut it. */
    openHat: GainNode | null;
  } | null = null;

  /** A second of noise, made once for every hit's noise. */
  const makeNoise = (ctx: BaseAudioContext) => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  };

  /** A voice's output stage: a gain that peaks at once and falls away, into `out`. */
  function envelope(
    ctx: BaseAudioContext,
    out: AudioNode,
    time: number,
    peak: number,
    seconds: number
  ) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + ATTACK);
    gain.gain.exponentialRampToValueAtTime(SILENCE, time + seconds);
    gain.connect(out);
    return gain;
  }

  /** Runs a source until its sound has fallen away, then lets the nodes go. */
  function run(
    source: AudioScheduledSourceNode,
    time: number,
    seconds: number,
    onEnded?: () => void
  ) {
    source.start(time);
    source.stop(time + seconds + 0.02);
    source.onended = () => {
      source.disconnect();
      onEnded?.();
    };
  }

  function tone(
    out: AudioNode,
    time: number,
    {
      from,
      peak,
      seconds,
      sweep,
      to,
    }: {
      from: number;
      peak: number;
      seconds: number;
      sweep: number;
      to: number;
    }
  ) {
    if (!graph) {
      return;
    }
    const osc = graph.ctx.createOscillator();
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + sweep);
    osc.connect(envelope(graph.ctx, out, time, peak, seconds));
    run(osc, time, seconds);
  }

  function noise(
    out: AudioNode,
    time: number,
    { peak, seconds }: { peak: number; seconds: number },
    filter: { frequency: number; q?: number; type: BiquadFilterType }
  ) {
    if (!graph) {
      return;
    }
    const source = graph.ctx.createBufferSource();
    source.buffer = graph.noise;
    const biquad = graph.ctx.createBiquadFilter();
    biquad.type = filter.type;
    biquad.frequency.value = filter.frequency;
    biquad.Q.value = filter.q ?? 1;
    source
      .connect(biquad)
      .connect(envelope(graph.ctx, out, time, peak, seconds));
    run(source, time, seconds);
  }

  /** Squares at these frequencies, through a band: the stack of a hat, or of a cowbell. */
  function stack(
    out: AudioNode,
    time: number,
    frequencies: readonly number[],
    { peak, seconds }: { peak: number; seconds: number },
    bands: { centre: number; highpass?: number; q: number },
    onEnded?: () => void
  ) {
    if (!graph) {
      return;
    }
    const { ctx } = graph;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = bands.centre;
    band.Q.value = bands.q;
    const shaped = envelope(ctx, out, time, peak, seconds);
    if (bands.highpass) {
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = bands.highpass;
      band.connect(high).connect(shaped);
    } else {
      band.connect(shaped);
    }
    for (const [index, frequency] of frequencies.entries()) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = frequency;
      const share = ctx.createGain();
      share.gain.value = 1 / frequencies.length;
      osc.connect(share).connect(band);
      // The last of them to end has nothing left to hold.
      run(osc, time, seconds, index === 0 ? onEnded : undefined);
    }
  }

  const hatBands = (tune: number) => ({
    centre: 10_000,
    highpass: between(tune, 6000, 9000),
    q: 0.7,
  });

  const voices: Record<
    Instrument,
    (out: AudioNode, time: number, set: Settings, peak: number) => void
  > = {
    clap(out, time, set, peak) {
      // Three short claps a hair apart, then the tail of the room.
      const filter = {
        frequency: between(set.tone, 900, 2000),
        q: 1.5,
        type: "bandpass",
      } as const;
      for (const offset of [0, 0.011, 0.022]) {
        noise(out, time + offset, { peak: peak * 4, seconds: 0.012 }, filter);
      }
      noise(
        out,
        time + 0.033,
        { peak: peak * 3, seconds: between(set.decay, 0.1, 0.4) },
        filter
      );
    },
    closedHat(out, time, set, peak) {
      // A closed hat shuts an open one that is still ringing.
      graph?.openHat?.gain.setTargetAtTime(0, time, 0.004);
      stack(
        out,
        time,
        METAL,
        { peak: peak * 5, seconds: between(set.decay, 0.03, 0.12) },
        hatBands(set.tone)
      );
    },
    cowbell(out, time, set, peak) {
      stack(
        out,
        time,
        [540, between(set.tone, 740, 860)],
        { peak, seconds: between(set.decay, 0.12, 0.6) },
        { centre: 2640, q: 1 }
      );
    },
    highTom(out, time, set, peak) {
      const base = between(set.tone, 150, 260);
      tone(out, time, {
        from: base * 1.5,
        peak,
        seconds: between(set.decay, 0.12, 0.5),
        sweep: 0.06,
        to: base,
      });
    },
    kick(out, time, set, peak) {
      const base = between(set.tone, 40, 75);
      tone(out, time, {
        from: base * 3.2,
        peak,
        seconds: between(set.decay, 0.18, 1.2),
        sweep: 0.045,
        to: base,
      });
    },
    lowTom(out, time, set, peak) {
      const base = between(set.tone, 80, 140);
      tone(out, time, {
        from: base * 1.5,
        peak,
        seconds: between(set.decay, 0.15, 0.6),
        sweep: 0.07,
        to: base,
      });
    },
    openHat(out, time, set, peak) {
      if (!graph) {
        return;
      }
      const choke = graph.ctx.createGain();
      choke.connect(out);
      graph.openHat = choke;
      stack(
        choke,
        time,
        METAL,
        { peak: peak * 4, seconds: between(set.decay, 0.25, 0.9) },
        hatBands(set.tone),
        () => choke.disconnect()
      );
    },
    snare(out, time, set, peak) {
      const base = between(set.tone, 150, 220);
      tone(out, time, {
        from: base * 1.4,
        peak: peak * 0.6,
        seconds: 0.09,
        sweep: 0.02,
        to: base,
      });
      tone(out, time, {
        from: base * 2.6,
        peak: peak * 0.35,
        seconds: 0.06,
        sweep: 0.02,
        to: base * 1.85,
      });
      noise(
        out,
        time,
        { peak: peak * 0.7, seconds: between(set.decay, 0.08, 0.35) },
        { frequency: 1500, type: "highpass" }
      );
    },
  };

  return {
    /** Builds the mix into `destination` (the bus): nothing sounds until a hit. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const mix = ctx.createGain();
      mix.gain.value = MIX_GAIN;
      mix.connect(destination);
      graph = { ctx, mix, noise: makeNoise(ctx), openHat: null };
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = hertz(ROOT);
      // Two low-pass stages make a steeper slope, the first one carrying the resonance.
      const first = ctx.createBiquadFilter();
      first.type = "lowpass";
      first.frequency.value = cutoffHertz(bassSettings.cutoff);
      first.Q.value = unit(bassSettings.reso) * 14;
      const second = ctx.createBiquadFilter();
      second.type = "lowpass";
      second.frequency.value = cutoffHertz(bassSettings.cutoff);
      second.Q.value = 0.7;
      const amp = ctx.createGain();
      amp.gain.value = 0;
      osc.connect(first).connect(second).connect(amp).connect(destination);
      osc.start();
      bass = { amp, first, osc, second };
    },
    /** Disconnects what this engine made; the shared context stays. */
    detach() {
      graph?.mix.disconnect();
      graph = null;
      if (bass) {
        bass.osc.stop();
        bass.amp.disconnect();
      }
      bass = null;
    },
    /** Closes the bass note now, for a stop: no note is left hanging. */
    silence() {
      if (graph && bass) {
        const now = graph.ctx.currentTime;
        bass.amp.gain.cancelScheduledValues(now);
        bass.amp.gain.setTargetAtTime(0, now, 0.012);
      }
    },
    /** Opens a bass note at `time`; the filter leaps open and falls back over the decay. */
    noteOn(time: number, pitch: number, accent: boolean) {
      if (!bass) {
        return;
      }
      const { amp, first, osc, second } = bass;
      osc.frequency.cancelScheduledValues(time);
      osc.frequency.setValueAtTime(hertz(ROOT + pitch), time);
      const base = cutoffHertz(bassSettings.cutoff);
      const reach = unit(bassSettings.envmod) * 4 * (accent ? 1.4 : 1);
      const peak = Math.min(18_000, base * 2 ** reach);
      const decay =
        0.08 * 25 ** unit(bassSettings.bassDecay) * (accent ? 0.6 : 1);
      for (const filter of [first, second]) {
        filter.frequency.cancelScheduledValues(time);
        filter.frequency.setValueAtTime(peak, time);
        filter.frequency.setTargetAtTime(base, time, decay / 3);
      }
      amp.gain.cancelScheduledValues(time);
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(
        accent ? BASS_ACCENT : BASS_LEVEL,
        time + 0.003
      );
    },
    /** Closes the bass note at `time`. */
    noteOff(time: number) {
      bass?.amp.gain.setTargetAtTime(0, time, 0.012);
    },
    /** One bass knob moved. */
    setBass(control: BassControl, value: number) {
      bassSettings[control] = value;
      if (graph && bass && control === "reso") {
        bass.first.Q.setTargetAtTime(
          unit(value) * 14,
          graph.ctx.currentTime,
          0.02
        );
      }
    },
    /** One control of one instrument moved. */
    set(instrument: Instrument, control: Control, value: number) {
      kit[instrument][control] = value;
    },
    /** Hits an instrument at `time` on the audio clock; `velocity` is from 0 to 1. */
    trigger(instrument: Instrument, time: number, velocity = 1) {
      if (!graph) {
        return;
      }
      const set = kit[instrument];
      const peak = levelGain(set.level) * velocity;
      if (peak > 0) {
        voices[instrument](graph.mix, time, set, peak);
      }
    },
  };
}

export type MiraEngine = ReturnType<typeof createMiraEngine>;
