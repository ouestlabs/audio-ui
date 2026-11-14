import {
  createFrameTask,
  createSource,
  type FrameTask,
  type Source,
} from "@audio-ui/core";
import type { MeterFrame } from "@audio-ui/core/meter";
import {
  type LogSpectrumOptions,
  logSpectrum,
  peakDb,
  rmsDb,
  SPECTRUM_FLOOR_DB,
} from "@audio-ui/engine/analysis";
import type {
  Device,
  DeviceReadings,
  DeviceTaps,
  ParameterDescriptor,
} from "@audio-ui/engine/device";

/** The level a meter of silence reads, in dB. */
const SILENCE_DB = -100;
/** Under this, a point counts as silent, in dB: below the noise of any sound worth showing. */
const QUIET_DB = -80;
/** How long a point stays active once it falls silent, in ms: a rest between two notes is not "no signal". */
const ACTIVE_HOLD_MS = 400;
/** How fast a level falls back once the sound drops, in dB per second; it rises at once. */
const RELEASE_DB_PER_SECOND = 30;
const PEAK_HOLD_MS = 1500;
const PEAK_FALL_DB_PER_SECOND = 12;
/** Samples a level is read over each frame: longer than a frame, so no peak falls between two reads. */
const LEVEL_SAMPLES = 2048;
/** Samples of the analyser a scope, a spectrum and a history read: 85 ms at 48 kHz. */
const MONO_SAMPLES = 4096;
const SPECTRUM_SMOOTHING = 0.8;

/**
 * What a signal listens to: a device's engine, or anything with an output.
 * An effect's engine and an instrument's both are one.
 */
export interface SignalTarget {
  readonly input?: AudioNode | null;
  readonly output: AudioNode;
  readonly readings?: () => DeviceReadings;
  readonly taps?: DeviceTaps;
}

/** The two channels of a point, their latest samples, -1 to 1: what a stereo field is drawn from. */
export interface StereoSamples {
  left: Float32Array;
  right: Float32Array;
}

export interface SpectrumOptions extends LogSpectrumOptions {
  /** How many values, spread along a log frequency axis. @default 160 */
  points?: number;
}

export interface HistoryOptions {
  /** What each value is: the signal itself, as a modulator's position (`"value"`), or its level in dB (`"level"`). @default "value" */
  of?: "level" | "value";
  /** How many values the window holds, spread evenly over it. @default 240 */
  points?: number;
  /** How far back it reaches, in seconds. */
  seconds: number;
}

/**
 * One point of a device's sound, such as what goes in or what comes out, read
 * as live sources. Each source listens only while something watches it: the
 * first watcher puts an analyser on the point, the last one to leave takes it
 * off, and nothing is read in between. None renders React: a meter or a plot
 * paints from it straight in the DOM.
 */
export interface SignalPoint {
  /** Whether sound passes here: `false` once it has been silent for a moment, and with nothing to listen to. */
  readonly active: Source<boolean>;
  /**
   * What the point held over the last `seconds`, oldest first: the signal
   * itself (a modulator's position, -1 to 1) or its level in dB. It scrolls
   * as time passes, and it is real samples, read between the frames.
   */
  history: (options: HistoryOptions) => Source<Float32Array>;
  /** Its level per channel, in dB: the RMS, rising at once and falling back, and the loudest sample, held a moment. What a `Meter` paints. */
  readonly levels: Source<MeterFrame>;
  /**
   * Its latest `length` samples, -1 to 1, from where the wave last rose
   * through zero, so a steady tone stands still: what a scope draws.
   */
  scope: (length?: number) => Source<Float32Array>;
  /** Its spectrum along a log frequency axis, in dB. */
  spectrum: (options?: SpectrumOptions) => Source<Float32Array>;
  /** Its two channels' latest samples: what a stereo field is drawn from. A mono sound is on both. */
  readonly stereo: Source<StereoSamples>;
}

/**
 * Everything a device's face can show of its sound, as live sources: what
 * goes in (an effect's), what comes out, the points its engine names in its
 * `taps` and the readings it reports, each one present when the device
 * declares it in `signals`.
 */
export interface DeviceSignal {
  /** What goes in. `null` for an instrument, which takes notes, not sound. */
  readonly input: SignalPoint | null;
  /** What moves the sound: its LFO, from -1 to 1, for a device that declares `modulator`. */
  readonly modulator: SignalPoint | null;
  readonly output: SignalPoint;
  /** What it reports of itself, read each frame. */
  readonly readings: Source<DeviceReadings>;
  /** The gain it takes off now, in dB, 0 or negative, for a device that declares `gainReduction`. */
  readonly reduction: Source<number> | null;
  /** Its processed sound alone, for a device that declares `wet`. */
  readonly wet: SignalPoint | null;
}

type Reader = (elapsedMs: number) => void;
const readers = new Set<Reader>();
let loop: FrameTask | null = null;

/**
 * Runs `reader` every animation frame, with every other reader of the page,
 * until the function it returns is called: one frame loop for every signal on
 * screen, asleep once nothing is watched.
 */
function everyFrame(reader: Reader): () => void {
  readers.add(reader);
  loop ??= createFrameTask((elapsed) => {
    for (const read of readers) {
      read(elapsed);
    }
    return readers.size > 0;
  });
  loop.wake();
  return () => {
    readers.delete(reader);
  };
}

/**
 * A source that starts its work when its first listener comes and stops it
 * when its last one leaves: `start` is given the publish function and
 * returns how to stop.
 */
function watchedSource<T>(
  initial: T,
  start: (publish: (value: T) => void) => () => void
): Source<T> {
  const source = createSource(initial);
  let watchers = 0;
  let stop: (() => void) | null = null;
  return {
    getSnapshot: source.getSnapshot,
    subscribe: (listener) => {
      const leave = source.subscribe(listener);
      watchers += 1;
      if (watchers === 1) {
        stop = start(source.set);
      }
      let left = false;
      return () => {
        if (left) {
          return;
        }
        left = true;
        leave();
        watchers -= 1;
        if (watchers === 0) {
          stop?.();
          stop = null;
        }
      };
    },
  };
}

interface TapNodes {
  disconnect: () => void;
  /** What the point is connected to. */
  input: AudioNode;
}

/**
 * Analysers on one point, shared by every source that reads it: made on the
 * first `use`, taken off with the last release, and moved over to the new
 * node when the point's node changes, as when a host makes the device's
 * engine again. With no node, `current` is `null`.
 */
function createTap<Nodes extends TapNodes>(
  node: () => AudioNode | null | undefined,
  make: (ctx: BaseAudioContext) => Nodes
) {
  let users = 0;
  let bound: AudioNode | null = null;
  let nodes: Nodes | null = null;
  const unbind = () => {
    if (bound && nodes) {
      try {
        bound.disconnect(nodes.input);
      } catch {
        // The engine was disposed first, and its node let go of every connection.
      }
    }
    bound = null;
  };
  return {
    current: (): Nodes | null => {
      const now = node() ?? null;
      if (now !== bound) {
        unbind();
        if (now) {
          if (nodes && nodes.input.context !== now.context) {
            nodes.disconnect();
            nodes = null;
          }
          nodes ??= make(now.context);
          now.connect(nodes.input);
          bound = now;
        }
      }
      return bound ? nodes : null;
    },
    use: () => {
      users += 1;
      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;
        users -= 1;
        if (users === 0) {
          unbind();
          nodes?.disconnect();
          nodes = null;
        }
      };
    },
  };
}

/** One analyser of the point's channels mixed down: for a scope, a spectrum and a history. */
function makeMono(ctx: BaseAudioContext) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = MONO_SAMPLES;
  analyser.smoothingTimeConstant = SPECTRUM_SMOOTHING;
  return { analyser, disconnect: () => analyser.disconnect(), input: analyser };
}

/** An analyser per channel, a mono sound spread to both first: for levels and a stereo field. */
function makeStereo(ctx: BaseAudioContext) {
  const spread = ctx.createGain();
  spread.channelCount = 2;
  spread.channelCountMode = "explicit";
  spread.channelInterpretation = "speakers";
  const split = ctx.createChannelSplitter(2);
  const analysers = [ctx.createAnalyser(), ctx.createAnalyser()] as const;
  spread.connect(split);
  analysers.forEach((analyser, channel) => {
    analyser.fftSize = LEVEL_SAMPLES;
    split.connect(analyser, channel);
  });
  return {
    analysers,
    disconnect: () => {
      spread.disconnect();
      split.disconnect();
    },
    input: spread,
  };
}

/** A level that rises at once and falls back, and a peak that holds and then falls. */
function createChannelFollower() {
  let level = SILENCE_DB;
  let peak = SILENCE_DB;
  let holdUntil = 0;
  return {
    step: (rms: number, loudest: number, seconds: number, now: number) => {
      level = Math.max(rms, level - RELEASE_DB_PER_SECOND * seconds, SILENCE_DB);
      if (loudest >= peak) {
        peak = loudest;
        holdUntil = now + PEAK_HOLD_MS;
      } else if (now > holdUntil) {
        peak = Math.max(loudest, peak - PEAK_FALL_DB_PER_SECOND * seconds);
      }
      return { db: level, peak };
    },
  };
}

const silentFrame = (): MeterFrame => ({
  levels: [SILENCE_DB, SILENCE_DB],
  peaks: [SILENCE_DB, SILENCE_DB],
});

const isSilentFrame = (frame: MeterFrame) =>
  frame.levels.every((db) => db <= SILENCE_DB) &&
  (frame.peaks ?? []).every((db) => db <= SILENCE_DB);

/** The point that `node` stands for, read as live sources. */
function createSignalPoint(
  node: () => AudioNode | null | undefined
): SignalPoint {
  const mono = createTap(node, makeMono);
  const stereo = createTap(node, makeStereo);

  /** The loudest sample of the last frame, in dB, and the levels: one read of the analysers shared by `levels` and `active`. */
  const meter = watchedSource<{ frame: MeterFrame; loudest: number }>(
    { frame: silentFrame(), loudest: SILENCE_DB },
    (publish) => {
      const release = stereo.use();
      const followers = [createChannelFollower(), createChannelFollower()];
      const buffers = [
        new Float32Array(LEVEL_SAMPLES),
        new Float32Array(LEVEL_SAMPLES),
      ];
      const stop = everyFrame((elapsed) => {
        const nodes = stereo.current();
        const now = performance.now();
        const levels: number[] = [];
        const peaks: number[] = [];
        let loudest = SILENCE_DB;
        followers.forEach((follower, channel) => {
          let rms = SILENCE_DB;
          let top = SILENCE_DB;
          const buffer = buffers[channel] as Float32Array<ArrayBuffer>;
          if (nodes) {
            nodes.analysers[channel]?.getFloatTimeDomainData(buffer);
            rms = Math.max(SILENCE_DB, rmsDb(buffer));
            top = Math.max(SILENCE_DB, peakDb(buffer));
          }
          loudest = Math.max(loudest, top);
          const { db, peak } = follower.step(rms, top, elapsed / 1000, now);
          levels.push(db);
          peaks.push(peak);
        });
        publish({ frame: { levels, peaks }, loudest });
      });
      return () => {
        stop();
        release();
        publish({ frame: silentFrame(), loudest: SILENCE_DB });
      };
    }
  );

  const levels = watchedSource<MeterFrame>(silentFrame(), (publish) => {
    let last = silentFrame();
    const stop = meter.subscribe(() => {
      const { frame } = meter.getSnapshot();
      // Silence is published once, not every frame.
      if (!(isSilentFrame(frame) && isSilentFrame(last))) {
        last = frame;
        publish(frame);
      }
    });
    return () => {
      stop();
      publish(silentFrame());
    };
  });

  const active = watchedSource(false, (publish) => {
    let heard = Number.NEGATIVE_INFINITY;
    let on = false;
    const stop = meter.subscribe(() => {
      const now = performance.now();
      if (meter.getSnapshot().loudest > QUIET_DB) {
        heard = now;
      }
      const next = now - heard < ACTIVE_HOLD_MS;
      if (next !== on) {
        on = next;
        publish(on);
      }
    });
    return () => {
      stop();
      publish(false);
    };
  });

  const stereoSamples = watchedSource<StereoSamples>(
    {
      left: new Float32Array(LEVEL_SAMPLES),
      right: new Float32Array(LEVEL_SAMPLES),
    },
    (publish) => {
      const release = stereo.use();
      const samples = {
        left: new Float32Array(LEVEL_SAMPLES),
        right: new Float32Array(LEVEL_SAMPLES),
      };
      let silent = false;
      const stop = everyFrame(() => {
        const nodes = stereo.current();
        if (nodes) {
          nodes.analysers[0].getFloatTimeDomainData(samples.left);
          nodes.analysers[1].getFloatTimeDomainData(samples.right);
        }
        const quiet =
          !nodes ||
          (peakDb(samples.left) < QUIET_DB && peakDb(samples.right) < QUIET_DB);
        if (!nodes) {
          samples.left.fill(0);
          samples.right.fill(0);
        }
        if (!(quiet && silent)) {
          publish(samples);
        }
        silent = quiet;
      });
      return () => {
        stop();
        release();
      };
    }
  );

  const scopes = new Map<number, Source<Float32Array>>();
  const scope = (length = 1024) => {
    const kept = scopes.get(length);
    if (kept) {
      return kept;
    }
    const made = watchedSource(new Float32Array(length), (publish) => {
      const release = mono.use();
      const buffer = new Float32Array(MONO_SAMPLES);
      const out = new Float32Array(length);
      let silent = false;
      const stop = everyFrame(() => {
        const nodes = mono.current();
        if (nodes) {
          nodes.analyser.getFloatTimeDomainData(buffer);
        } else {
          buffer.fill(0);
        }
        // The newest window that starts where the wave rises through zero: a steady tone stands still.
        let start = buffer.length - length;
        for (let index = start; index > 0; index -= 1) {
          if (
            (buffer[index - 1] as number) < 0 &&
            (buffer[index] as number) >= 0
          ) {
            start = index;
            break;
          }
        }
        out.set(buffer.subarray(start, start + length));
        const quiet = peakDb(out) < QUIET_DB;
        if (!(quiet && silent)) {
          publish(out);
        }
        silent = quiet;
      });
      return () => {
        stop();
        release();
        publish(new Float32Array(length));
      };
    });
    scopes.set(length, made);
    return made;
  };

  const spectra = new Map<string, Source<Float32Array>>();
  const spectrum = ({ maxHz, minHz, points = 160 }: SpectrumOptions = {}) => {
    const key = `${minHz}:${maxHz}:${points}`;
    const kept = spectra.get(key);
    if (kept) {
      return kept;
    }
    const floor = () => new Float32Array(points).fill(SPECTRUM_FLOOR_DB);
    const made = watchedSource<Float32Array>(floor(), (publish) => {
      const release = mono.use();
      const bins = new Float32Array(MONO_SAMPLES / 2);
      const out = floor();
      let resting = false;
      const stop = everyFrame(() => {
        const nodes = mono.current();
        if (!nodes) {
          if (!resting) {
            out.fill(SPECTRUM_FLOOR_DB);
            publish(out);
          }
          resting = true;
          return;
        }
        resting = false;
        nodes.analyser.getFloatFrequencyData(bins);
        publish(
          logSpectrum(bins, nodes.analyser.context.sampleRate, out, {
            maxHz,
            minHz,
          })
        );
      });
      return () => {
        stop();
        release();
        publish(floor());
      };
    });
    spectra.set(key, made);
    return made;
  };

  const histories = new Map<string, Source<Float32Array>>();
  const history = ({ of = "value", points = 240, seconds }: HistoryOptions) => {
    const key = `${of}:${points}:${seconds}`;
    const kept = histories.get(key);
    if (kept) {
      return kept;
    }
    const rest = of === "level" ? SILENCE_DB : 0;
    const made = watchedSource(
      new Float32Array(points).fill(rest),
      (publish) => {
        const release = mono.use();
        const buffer = new Float32Array(MONO_SAMPLES);
        const ring = new Float32Array(points).fill(rest);
        const out = new Float32Array(points).fill(rest);
        const slotMs = (seconds * 1000) / points;
        let head = 0;
        let carry = 0;
        const stop = everyFrame((elapsed) => {
          carry += elapsed;
          const fresh = Math.min(points, Math.floor(carry / slotMs));
          if (fresh === 0) {
            return;
          }
          carry -= fresh * slotMs;
          const nodes = mono.current();
          if (nodes) {
            nodes.analyser.getFloatTimeDomainData(buffer);
          }
          const slotSamples = nodes
            ? Math.max(
                1,
                Math.round((slotMs / 1000) * nodes.analyser.context.sampleRate)
              )
            : 1;
          // The slots that passed since the last frame, oldest first, each read where it falls in the analyser's samples.
          for (let back = fresh - 1; back >= 0; back -= 1) {
            const end = Math.max(1, buffer.length - back * slotSamples);
            let value = rest;
            if (nodes && of === "level") {
              value = Math.max(
                SILENCE_DB,
                rmsDb(buffer.subarray(Math.max(0, end - slotSamples), end))
              );
            } else if (nodes) {
              value = buffer[end - 1] as number;
            }
            ring[head] = value;
            head = (head + 1) % points;
          }
          out.set(ring.subarray(head), 0);
          out.set(ring.subarray(0, head), points - head);
          publish(out);
        });
        return () => {
          stop();
          release();
          publish(new Float32Array(points).fill(rest));
        };
      }
    );
    histories.set(key, made);
    return made;
  };

  return { active, history, levels, scope, spectrum, stereo: stereoSamples };
}

const sameReadings = (a: DeviceReadings, b: DeviceReadings) => {
  if (a.gainReductionDb !== b.gainReductionDb) {
    return false;
  }
  const bandsA = a.bandGainReductionDb ?? {};
  const bandsB = b.bandGainReductionDb ?? {};
  const names = Object.keys(bandsA);
  return (
    names.length === Object.keys(bandsB).length &&
    names.every((name) => bandsA[name] === bandsB[name])
  );
};

/**
 * The live signal of a device, from its engine, as a face shows it: what goes
 * in and comes out, and what its device declares in `signals` (its
 * `gainReduction`, its `modulator` and `wet` taps). `target` is read each
 * frame, so the signal follows the engine a host makes again, and is silent
 * while there is none; nothing is listened to until a source is watched, and
 * the last watcher to leave takes every analyser off. It never changes the
 * sound: an analyser plays nothing, and nothing is connected to the output.
 *
 * ```ts
 * const signal = createDeviceSignal(() => engine, compressorDevice);
 * signal.output.levels // what a Meter paints
 * signal.reduction // the dB it takes off
 * ```
 */
export function createDeviceSignal(
  target: () => SignalTarget | null | undefined,
  device: Pick<Device<readonly ParameterDescriptor[]>, "kind" | "signals">
): DeviceSignal {
  const declares = (name: (typeof device.signals)[number]) =>
    device.signals.includes(name);
  const readings = watchedSource<DeviceReadings>({}, (publish) => {
    let last: DeviceReadings = {};
    const stop = everyFrame(() => {
      const now = target()?.readings?.() ?? {};
      if (!sameReadings(now, last)) {
        last = now;
        publish(now);
      }
    });
    return () => {
      stop();
      publish({});
    };
  });
  return {
    input:
      device.kind === "instrument"
        ? null
        : createSignalPoint(() => target()?.input),
    modulator: declares("modulator")
      ? createSignalPoint(() => target()?.taps?.modulator)
      : null,
    output: createSignalPoint(() => target()?.output),
    readings,
    reduction: declares("gainReduction")
      ? watchedSource(0, (publish) => {
          let last = 0;
          const stop = readings.subscribe(() => {
            const db = readings.getSnapshot().gainReductionDb ?? 0;
            if (db !== last) {
              last = db;
              publish(db);
            }
          });
          return () => {
            stop();
            publish(0);
          };
        })
      : null,
    wet: declares("wet") ? createSignalPoint(() => target()?.taps?.wet) : null,
  };
}
