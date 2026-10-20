/**
 * The sound of Vesta-16: a sampler of drum hits. A kit is sixteen samples in
 * buffers, a pad plays one, and the pad's own knobs shape the play: the tune
 * changes the speed it is read at, the decay cuts the tail, the level and the
 * pan place it. The closed and the open hat choke each other, as one cymbal.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Hits are scheduled on the audio clock (`time`), and the
 * engine plays into the bus it is attached to, which owns the master level and
 * the safety limiter.
 */

export const PADS = 16;
export const STEPS = 16;

export type PadControl = "decay" | "level" | "pan" | "tune";
export type PadSettings = Record<PadControl, number>;

export const DEFAULT_PAD: PadSettings = { decay: 8, level: 7, pan: 5, tune: 5 };

/** The pads that share a choke group: the closed and the open hat. */
const HATS = [5, 6];

const unit = (value: number) => value / 10;
/** The tune knob in semitones: two octaves, the middle at rest. */
export const semitones = (value: number) => (value - 5) * 2.4;
export const levelGain = (value: number) => unit(value) ** 1.5 * 1.1;
export const panPosition = (value: number) => (value - 5) / 5;
/** The share of the sample that plays before the tail is cut. */
export const tailShare = (value: number) => 0.12 + unit(value) * 0.88;

interface Playing {
  gain: GainNode;
  source: AudioBufferSourceNode;
}

export function createVestaEngine() {
  const pads: PadSettings[] = Array.from({ length: PADS }, () => ({
    ...DEFAULT_PAD,
  }));
  let buffers: AudioBuffer[] = [];
  let graph: { ctx: BaseAudioContext; mix: GainNode } | null = null;
  const ringing = new Map<number, Playing>();

  return {
    /** Builds the mix into `destination` (the bus): nothing sounds until a hit. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const mix = ctx.createGain();
      mix.gain.value = 0.8;
      mix.connect(destination);
      graph = { ctx, mix };
    },
    /** Stops the hits still ringing and disconnects what this engine made; the shared context stays. */
    detach() {
      for (const playing of ringing.values()) {
        playing.source.stop();
      }
      ringing.clear();
      graph?.mix.disconnect();
      graph = null;
    },
    /** Puts a kit in the pads: sixteen buffers. */
    load(next: AudioBuffer[]) {
      buffers = next;
    },
    /** One control of one pad moved. */
    setPad(pad: number, settings: PadSettings) {
      pads[pad] = { ...settings };
    },
    /** Plays a pad at `time` on the audio clock; `velocity` is from 0 to 1. */
    trigger(pad: number, time: number, velocity = 1) {
      const buffer = buffers[pad];
      const settings = pads[pad];
      if (!(graph && buffer && settings)) {
        return;
      }
      const { ctx, mix } = graph;
      if (HATS.includes(pad)) {
        for (const other of HATS) {
          const playing = ringing.get(other);
          if (playing) {
            playing.gain.gain.setTargetAtTime(0, time, 0.005);
          }
        }
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 2 ** (semitones(settings.tune) / 12);
      const length = buffer.duration / source.playbackRate.value;
      const gain = ctx.createGain();
      const level = levelGain(settings.level) * (0.25 + 0.75 * velocity);
      gain.gain.setValueAtTime(level, time);
      const cutAt = time + length * tailShare(settings.decay);
      gain.gain.setValueAtTime(level, cutAt);
      gain.gain.linearRampToValueAtTime(0, cutAt + 0.04);
      const panner = ctx.createStereoPanner();
      panner.pan.value = panPosition(settings.pan);
      source.connect(gain).connect(panner).connect(mix);
      source.start(time);
      source.stop(time + length + 0.05);
      const playing = { gain, source };
      ringing.set(pad, playing);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        panner.disconnect();
        if (ringing.get(pad) === playing) {
          ringing.delete(pad);
        }
      };
    },
  };
}

export type VestaEngine = ReturnType<typeof createVestaEngine>;
