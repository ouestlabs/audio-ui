import {
  autoWarp,
  detectTransients,
  estimateTempo,
  type TempoEstimate,
} from "@audio-ui/core/analysis";
import type { ParameterValue } from "@audio-ui/core/device";
import { type Breakpoint, levelAt } from "@audio-ui/core/envelope";
import type { Note } from "@audio-ui/core/piano-roll";
import type { PlayedClip, WarpMode } from "@audio-ui/core/playback";
import { unwarpedTime, type WarpMarker, warpedTime } from "@audio-ui/core/time";
import type { ClipValue } from "@audio-ui/react";

/** What a clip's menu does to it. */
export type ClipAction =
  | "duplicate"
  | "edit"
  | "remove"
  | "rename"
  | "split"
  | "toggle";

/** A clip laid on a track of an arrangement. */
export interface Arranged {
  /** A clip switched off stays on the page, drained, and is not heard. */
  disabled?: boolean;
  /** How much louder or quieter it plays, in dB. @default 0 */
  gain?: number;
  id: string;
  /**
   * A stretch of the source, `[start, end]` in the source's own time, that
   * repeats for as long as the clip lasts: a looped clip can be longer than
   * its source.
   */
  loop?: readonly [number, number];
  name: string;
  /**
   * A MIDI clip's notes, in its source's time: a note's `start` is seconds
   * from where the source begins, as an audio clip's offset is, so trimming
   * or moving the clip leaves each note where it was in the source.
   */
  notes?: readonly Note[];
  /**
   * The id of the recording an audio clip plays. Every piece cut from the clip,
   * and every copy of it, plays the same one.
   */
  recording?: string;
  /** Whether its source plays backwards. */
  reversed?: boolean;
  /** Where its source begins in the recording it was cut from, once cropped. @default 0 */
  sourceFrom?: number;
  /** How long the recording behind the clip is: trimming stops where it runs out. */
  sourceLength: number;
  /** A MIDI clip's swing: its notes stay on the grid, and play late on the off-beats. */
  swing?: ClipSwing;
  /** The id of the track it lies on. */
  track: string;
  /** How far it is transposed, in semitones. @default 0 */
  transpose?: number;
  /** Where the clip sits, how much of its source it plays, and its fades. */
  value: ClipValue;
  /**
   * Markers pinning times in the source to times on the clip: the source is
   * stretched between them, and the clip's other times (where it starts in
   * its source, its loop) are on the clip.
   */
  warp?: readonly WarpMarker[];
  /** How it plays at another speed than its recording's: its pitch with its speed, or kept, in slices or in grains. @default "repitch" */
  warpMode?: WarpMode;
}

/** What a track holds: recordings, or notes for an instrument to play. */
/** What a track holds: audio clips, MIDI clips, or other tracks (a group, which holds no clip and plays what its tracks play). */
export type TrackKind = "audio" | "group" | "midi";

/**
 * A parameter of a device on a track, by the device's id and the parameter's,
 * at any depth of its racks: `device:<device>:<parameter>`. A rack's macros
 * are its parameters `macro-1` to `macro-8`.
 */
export type DeviceParameterKey = `device:${string}:${string}`;

/** What a track's automation can move: its volume, where it sits in the stereo field, or a parameter of one of its devices. */
export type AutomatedParameter = "pan" | "volume" | DeviceParameterKey;

/** The key a device's parameter is automated under. */
export const deviceParameterKey = (
  device: string,
  parameter: string
): DeviceParameterKey => `device:${device}:${parameter}`;

/** The device and the parameter a key names, or null for the track's own volume and pan. */
export function parseDeviceParameter(
  key: string
): { device: string; parameter: string } | null {
  if (!key.startsWith("device:")) {
    return null;
  }
  const end = key.indexOf(":", "device:".length);
  return end === -1
    ? null
    : {
        device: key.slice("device:".length, end),
        parameter: key.slice(end + 1),
      };
}

/** The index of a rack's macro a parameter id names, `macro-1` to `macro-8`, or -1. */
export function macroIndex(parameter: string): number {
  const match = MACRO_PARAMETER.exec(parameter);
  return match ? Number(match[1]) - 1 : -1;
}

const MACRO_PARAMETER = /^macro-([1-8])$/;

/**
 * A track's automation: for each parameter it moves, the points of its
 * envelope across the whole arrangement, `x` from its start (0) to its end
 * (1) and `y` the parameter's value from 0 to 1, with the curve of the
 * segment leaving each point. Being shares of the song, the points keep
 * their musical place when the tempo changes; when the arrangement grows or
 * shrinks, or time is inserted or taken out, they are retimed so each keeps
 * its time.
 */
export type TrackAutomation = Partial<
  Record<AutomatedParameter, readonly Breakpoint[]>
>;

/**
 * A device on a track's chain: which one (its stable id, such as
 * `audioui.compressor`), its state, and whether it is switched on. Its own id
 * stays the same as it moves along the chain.
 */
export interface TrackDevice {
  /** The id of the device it is, as its description gives it. */
  device: string;
  id: string;
  /** An instrument comes first on a MIDI track, before every effect. */
  instrument?: boolean;
  /** A device switched off passes the sound on unchanged. @default true */
  on?: boolean;
  /** A rack's chains and macros: what a device of the kind `audioui.rack`, `audioui.instrument-rack` or `audioui.drum-rack` holds instead of a state of its own. */
  rack?: Rack;
  state: Readonly<Record<string, ParameterValue>>;
}

/** A chain of a rack: devices in series, and how loud and where it sits in what the rack sums. */
export interface RackChain {
  devices: readonly TrackDevice[];
  id: string;
  /** Its volume, pan and switches; a chain with none plays at unity. */
  mix?: { gain: number; muted: boolean; pan: number; soloed: boolean };
  name: string;
  /** In a drum rack: the note the chain answers, and the sound it plays into its devices. */
  pad?: DrumPad;
  /** In an instrument rack: the notes the chain plays. A chain with none plays them all. */
  zone?: ChainZone;
}

/** The notes a chain of an instrument rack plays: its keys, lowest to highest pitch, and its velocities, 0 to 1, both ends in. */
export interface ChainZone {
  keys: readonly [number, number];
  velocity: readonly [number, number];
}

/** The zone of a chain with none: every key, every velocity. */
export const FULL_ZONE: ChainZone = { keys: [0, 127], velocity: [0, 1] };

/** Whether a chain plays a note of `pitch` struck as hard as `velocity`: inside its keys and its velocities. */
export function inZone(
  zone: ChainZone | undefined,
  pitch: number,
  velocity: number
): boolean {
  const { keys, velocity: range } = zone ?? FULL_ZONE;
  return (
    pitch >= keys[0] &&
    pitch <= keys[1] &&
    velocity >= range[0] &&
    velocity <= range[1]
  );
}

/** The voices of the drum synthesis a pad can play. */
export type DrumVoice = "hat" | "kick" | "snare";

/**
 * What a pad of a drum rack plays: a voice of the drum synthesis, or a
 * recording, `tune` semitones from its own pitch, for `decay` seconds (a
 * recording ends sooner when it is shorter).
 */
export type DrumSound =
  | { decay: number; kind: "synth"; tune: number; voice: DrumVoice }
  | { decay: number; kind: "sample"; recording: string; tune: number };

/** The note a chain of a drum rack answers, 0 to 127, and the sound it plays. */
export interface DrumPad {
  note: number;
  sound: DrumSound;
}

/** A parameter a macro turns: the device by its id, and the stretch of the parameter's travel the macro's turn covers, 0 to 1 of it. */
export interface RackMapping {
  device: string;
  max: number;
  min: number;
  parameter: string;
}

/** A knob of a rack, 0 to 1, that turns the parameters mapped to it together. */
export interface RackMacro {
  mappings: readonly RackMapping[];
  name?: string;
  value: number;
}

/** Devices in parallel chains, summed, and eight macros over the devices inside. */
export interface Rack {
  chains: readonly RackChain[];
  macros: readonly RackMacro[];
}

/** The id a rack's track device carries in place of a device of the library. */
export const RACK_DEVICE = "audioui.rack";

/** How many macros a rack has. */
export const MACRO_COUNT = 8;

/** A rack with one chain holding `devices`, and its eight macros at rest, turning nothing. */
export function newRack(
  chain: string,
  devices: readonly TrackDevice[] = []
): Rack {
  return {
    chains: [{ devices, id: chain, name: "Chain 1" }],
    macros: Array.from({ length: MACRO_COUNT }, () => ({
      mappings: [],
      value: 0,
    })),
  };
}

/** The id an instrument rack's track device carries: an instrument whose chains each start with an instrument, played together by every note. */
export const INSTRUMENT_RACK_DEVICE = "audioui.instrument-rack";

/** The id a drum rack's track device carries: an instrument whose chains are pads, each played by a note. */
export const DRUM_RACK_DEVICE = "audioui.drum-rack";

/** How long each voice of the drum synthesis rings by default, in seconds. */
export const DRUM_DECAYS: Readonly<Record<DrumVoice, number>> = {
  hat: 0.05,
  kick: 0.2,
  snare: 0.15,
};

/** How long a recording on a pad plays by default, in seconds, unless it ends sooner. */
export const SAMPLE_DECAY = 2;

/** The kit a drum rack starts with: a kick on C2, a snare on D2 and a closed hat on F#2 (notes 36, 38 and 42), given the ids of their chains. */
export function newDrumRack(ids: readonly [string, string, string]): Rack {
  const pads: [DrumVoice, number, string][] = [
    ["kick", 36, "Kick"],
    ["snare", 38, "Snare"],
    ["hat", 42, "Hat"],
  ];
  return {
    chains: pads.map(([voice, note, name], index) => ({
      devices: [],
      id: ids[index] as string,
      name,
      pad: {
        note,
        sound: { decay: DRUM_DECAYS[voice], kind: "synth", tune: 0, voice },
      },
    })),
    macros: newRack("").macros,
  };
}

/** The recordings the pads of `tracks`' drum racks play: what a project keeps with its clips' recordings. */
export function padRecordings(
  tracks: readonly ArrangementTrack[]
): Set<string> {
  return new Set(
    tracks.flatMap((track) =>
      (track.devices ?? []).flatMap((device) =>
        device.rack
          ? [device, ...rackDevices(device.rack)].flatMap(
              (item) =>
                item.rack?.chains.flatMap((chain) =>
                  chain.pad?.sound.kind === "sample"
                    ? [chain.pad.sound.recording]
                    : []
                ) ?? []
            )
          : []
      )
    )
  );
}

/** A rack whose pads play the recordings `rename` gives for theirs, down the racks within it. */
function renamedRack(rack: Rack, rename: (id: string) => string): Rack {
  return {
    ...rack,
    chains: rack.chains.map((chain) => ({
      ...chain,
      devices: chain.devices.map((device) =>
        device.rack
          ? { ...device, rack: renamedRack(device.rack, rename) }
          : device
      ),
      ...(chain.pad?.sound.kind === "sample"
        ? {
            pad: {
              ...chain.pad,
              sound: {
                ...chain.pad.sound,
                recording: rename(chain.pad.sound.recording),
              },
            },
          }
        : {}),
    })),
  };
}

/** A track whose drum racks' pads play the recordings `rename` gives for theirs: what a project opened under new recording ids needs. */
export function renamePadRecordings(
  track: ArrangementTrack,
  rename: (id: string) => string
): ArrangementTrack {
  return track.devices?.some((device) => device.rack)
    ? {
        ...track,
        devices: track.devices.map((device) =>
          device.rack
            ? { ...device, rack: renamedRack(device.rack, rename) }
            : device
        ),
      }
    : track;
}

/** Every device inside a rack, down the racks within it. */
export function rackDevices(rack: Rack): TrackDevice[] {
  return rack.chains.flatMap((chain) =>
    chain.devices.flatMap((device) =>
      device.rack ? [device, ...rackDevices(device.rack)] : [device]
    )
  );
}

/** A track's color: an index into the colors the timeline offers, or a color of the user's own as a CSS hex such as `#3e63dd`. */
export type TrackColor = number | string;

/** A track of an arrangement. */
export interface ArrangementTrack {
  /** Its automation, by parameter. */
  automation?: TrackAutomation;
  /** An index into the colors a track can take, or a color of the user's own as a CSS hex. */
  color: TrackColor;
  /** Its device chain, from first to last. */
  devices?: readonly TrackDevice[];
  /** The group track it is in, which its sound plays into; none, it plays into the main track. A group's tracks follow it in the list. */
  group?: string;
  id: string;
  /** @default "audio" */
  kind?: TrackKind;
  /** What its header sets: a track that has none plays at unity. Undo takes it back, and a duplicate of the track keeps it. */
  mix?: Mix;
  name: string;
  /** On a return track: whether what the others send it is taken before their volume, pan and switch, rather than after. @default false */
  pre?: boolean;
  /** How much it sends to each return track, by the return's id, as a gain from 0 (silence, the default) to 1 (0 dB). */
  sends?: Readonly<Record<string, number>>;
}

/** What a track's header sets: how loud it is, where it sits in the stereo field, and whether it is silenced or soloed. */
export interface Mix {
  /** An index into the colors a track can take, or a color of the user's own as a CSS hex. */
  color: TrackColor;
  gain: number;
  muted: boolean;
  /** From -1 (left) to 1 (right). */
  pan: number;
  soloed: boolean;
}

export const UNITY_MIX: Mix = {
  color: 0,
  gain: 1,
  muted: false,
  pan: 0,
  soloed: false,
};

/** What a track's header shows: its mix, over unity, with the track's own color. */
export function mixOf(track: ArrangementTrack): Mix {
  return { ...UNITY_MIX, ...track.mix, color: track.color };
}

/** Where files or a device dropped on the add-track button go: a track of their own. */
export const NEW_TRACK = "new";

/** Whether a track has an output: a MIDI track with no instrument has none, so no volume, pan or sends (MIX-024). */
export function hasOutput(track: ArrangementTrack): boolean {
  return (
    track.kind !== "midi" ||
    (track.devices ?? []).some((device) => device.instrument)
  );
}

/**
 * The parameter a track's lane shows in automation mode: the one `shown`, or
 * for a track with no output, whose volume and pan are gone (MIX-024), its
 * first device parameter. Null when there is none to show.
 */
export function automatedParameter(
  track: ArrangementTrack,
  shown: AutomatedParameter,
  targets: readonly { key: AutomatedParameter }[] = []
): AutomatedParameter | null {
  if (hasOutput(track) || (shown !== "volume" && shown !== "pan")) {
    return shown;
  }
  return targets[0]?.key ?? null;
}

/**
 * How far a clip can be stretched on the timeline: `undefined` when it loops,
 * since it has no end then, as far as its warp stretches its source when it
 * is warped, otherwise the length of its source.
 */
export function clipReach(clip: Arranged): number | undefined {
  if (clip.loop) {
    return;
  }
  return clip.warp
    ? warpedTime(clip.warp, clip.sourceLength)
    : clip.sourceLength;
}

const PEAK_LEVELS = new WeakMap<object, ArrayLike<number>[]>();

/**
 * The peaks, then the farthest of every two, of every four and so on, kept with
 * them: however many a column covers, it reads a few. `pick` is `Math.max`, or
 * `Math.min` for a list of the lowest samples.
 */
function peakLevels(
  peaks: ArrayLike<number>,
  pick: (a: number, b: number) => number
): ArrayLike<number>[] {
  const kept = PEAK_LEVELS.get(peaks);
  if (kept) {
    return kept;
  }
  const levels = [peaks];
  for (
    let level = peaks;
    level.length > 1;
    level = levels.at(-1) as ArrayLike<number>
  ) {
    const coarser = new Float32Array(Math.ceil(level.length / 2));
    for (let index = 0; index < coarser.length; index += 1) {
      coarser[index] = pick(level[index * 2] ?? 0, level[index * 2 + 1] ?? 0);
    }
    levels.push(coarser);
  }
  PEAK_LEVELS.set(peaks, levels);
  return levels;
}

/** The farthest peak from `from` to `to`, both in, read at the level where that is a handful of entries: no peak is ever missed. */
function farthestPeak(
  levels: readonly ArrayLike<number>[],
  pick: (a: number, b: number) => number,
  from: number,
  to: number
): number {
  const shift = Math.min(
    levels.length - 1,
    31 - Math.clz32(Math.max(1, (to - from) >> 2))
  );
  const level = levels[shift] as ArrayLike<number>;
  let farthest = 0;
  for (let index = from >> shift; index <= to >> shift; index += 1) {
    farthest = pick(farthest, level[index] ?? 0);
  }
  return farthest;
}

/** A recording's shape: an amplitude per slice from 0 to 1, or its lowest and highest samples, from -1 to 1. */
export type ClipPeaks =
  | ArrayLike<number>
  | { max: ArrayLike<number>; min: ArrayLike<number> };

/** What reading a clip's recording takes: how it plays, not where it lies. */
export type ClipReading = Pick<
  Arranged,
  "loop" | "reversed" | "sourceLength" | "warp"
> & { value: Pick<ClipValue, "length" | "offset"> };

/** How many slices `peaks` holds. */
export const clipPeakCount = (peaks: ClipPeaks) =>
  "length" in peaks
    ? peaks.length
    : Math.min(peaks.max.length, peaks.min.length);

/** Which peaks each of `columns` covers, across a stretch of a clip as a player reads it. */
function columnSpans(
  clip: ClipReading,
  peakCount: number,
  columns: number,
  range: readonly [number, number] = [0, clip.value.length]
): [number, number][] {
  const { length, offset } = clip.value;
  const count = Math.max(0, Math.floor(columns));
  if (peakCount === 0 || !(clip.sourceLength > 0) || length <= 0) {
    return Array.from({ length: count }, (): [number, number] => [0, 0]);
  }
  const span = clip.warp
    ? warpedTime(clip.warp, clip.sourceLength)
    : clip.sourceLength;
  /** The index of the peak at a time of the clip, from its start. */
  const peakAt = (time: number) => {
    let own = offset + time;
    if (clip.loop && own >= clip.loop[1]) {
      const [from, to] = clip.loop;
      own = from + ((own - from) % Math.max(Number.EPSILON, to - from));
    }
    const read = clip.reversed ? span - own : own;
    const source = clip.warp ? unwarpedTime(clip.warp, read) : read;
    return Math.floor((source / clip.sourceLength) * peakCount);
  };
  const toTime = (column: number) =>
    range[0] + (column / count) * (range[1] - range[0]);
  const spans: [number, number][] = [];
  let a = peakAt(toTime(0));
  for (let column = 0; column < count; column += 1) {
    const b = peakAt(toTime(column + 1));
    spans.push([Math.min(a, b), Math.max(a, b)]);
    a = b;
  }
  return spans;
}

/**
 * What an audio clip shows of its recording across its length, `columns`
 * amplitudes from 0 to 1, from the peaks of its source (`peaks`, spread evenly
 * over `sourceLength`): the stretch it plays, folded round its loop, mirrored
 * when reversed, stretched by its warp, as a player reads it. Each column is
 * the loudest peak it covers. `range` is the stretch of the clip to read, in
 * seconds from its start, for a view that shows part of it: the whole by default.
 */
export function clipWaveform(
  clip: ClipReading,
  peaks: ArrayLike<number>,
  columns: number,
  range?: readonly [number, number]
): number[] {
  const levels = peakLevels(peaks, Math.max);
  return columnSpans(clip, peaks.length, columns, range).map(([from, to]) =>
    farthestPeak(levels, Math.max, from, to)
  );
}

/**
 * The same read as `clipWaveform`, for each column the highest and the lowest
 * it reaches, from -1 to 1: the sound as it is, lopsided where it is. Amplitudes
 * have no lowest of their own, so they reach as far down as up.
 */
export function clipWaveformBands(
  clip: ClipReading,
  peaks: ClipPeaks,
  columns: number,
  range?: readonly [number, number]
): { max: number[]; min: number[] } {
  if ("length" in peaks) {
    const max = clipWaveform(clip, peaks, columns, range);
    return { max, min: max.map((level) => -level) };
  }
  const spans = columnSpans(clip, clipPeakCount(peaks), columns, range);
  const highs = peakLevels(peaks.max, Math.max);
  const lows = peakLevels(peaks.min, Math.min);
  return {
    max: spans.map(([from, to]) => farthestPeak(highs, Math.max, from, to)),
    min: spans.map(([from, to]) => farthestPeak(lows, Math.min, from, to)),
  };
}

/** A stretch of time on some tracks: what a drag across bare lanes selects. */
export interface TimeSelection {
  range: readonly [number, number];
  /** The tracks it spans, top to bottom. */
  tracks: string[];
}

/** What a copy holds: how long it is, and the part of each clip in it, from 0, with how many tracks below the first one it came from. */
export interface Clipping {
  length: number;
  parts: (Arranged & { row: number })[];
}

/**
 * How a MIDI clip swings: `amount` from 0, straight, to 1, where an off-beat
 * plays a third of a step late, as in a triplet; `division` is the step that
 * swings, an eighth or a sixteenth.
 */
export interface ClipSwing {
  amount: number;
  division: 8 | 16;
}

/**
 * Where `time` plays once swung on steps `step` long: the even steps stay,
 * the odd ones are pushed late by `amount` of a third of a step, and the time
 * between moves in a straight line, so no two notes ever change places.
 */
export function swungTime(time: number, step: number, amount: number): number {
  if (amount <= 0 || step <= 0) {
    return time;
  }
  const phase = (time / step) % 2;
  return time + ((amount * step) / 3) * (phase <= 1 ? phase : 2 - phase);
}

/** Where a note of a MIDI clip plays in the arrangement, transposed with the clip. */
export interface PlayedNote extends Note {
  /** The id of the note in the clip's source, which a looped clip plays more than once. */
  sourceId: Note["id"];
}

/**
 * The notes a MIDI clip plays, where they play in the arrangement: the ones
 * starting inside it, from where it starts in its source, and round its loop
 * again and again when it has one. A note runs to the clip's end at most,
 * and is transposed as the clip is. Each gets an id of its own, since a loop
 * plays a note more than once. Given `beat`, how long a beat lasts, a swung
 * clip's notes play swung; without it, they are where they are written.
 */
export function playedNotes(clip: Arranged, beat?: number): PlayedNote[] {
  const notes = clip.notes ?? [];
  const { length, offset, start } = clip.value;
  const end = start + length;
  const transpose = clip.transpose ?? 0;
  const { swing } = clip;
  const swung =
    swing && beat
      ? (time: number) =>
          swungTime(time, (beat * 4) / swing.division, swing.amount)
      : (time: number) => time;
  const played: PlayedNote[] = [];
  const place = (from: number, to: number, shift: number) => {
    for (const note of notes) {
      const heard = swung(note.start);
      const at = heard + shift;
      if (note.start < from || note.start >= to || at >= end) {
        continue;
      }
      played.push({
        ...note,
        id: `${note.id}@${at}`,
        length: Math.min(swung(note.start + note.length) - heard, end - at),
        pitch: note.pitch + transpose,
        sourceId: note.id,
        start: at,
      });
    }
  };
  if (!clip.loop) {
    place(offset, offset + length, start - offset);
    return played;
  }
  const [loopStart, loopEnd] = clip.loop;
  const span = loopEnd - loopStart;
  // The first pass plays from the offset to the loop's end, then the loop repeats.
  place(offset, loopEnd, start - offset);
  if (span > 0) {
    for (let pass = start + loopEnd - offset; pass < end; pass += span) {
      place(loopStart, loopEnd, pass - loopStart);
    }
  }
  return played;
}

/** The quietest a volume envelope reaches before silence, in dB, and its loudest. */
const VOLUME_FLOOR_DB = -60;

const VOLUME_CEILING_DB = 6;

/** A volume envelope's value, 0…1, as a gain: 0 is silence, then -60 dB up to +6 dB along the way. */
export function volumeGain(value: number): number {
  if (value <= 0) {
    return 0;
  }
  const db =
    VOLUME_FLOOR_DB +
    Math.min(1, value) * (VOLUME_CEILING_DB - VOLUME_FLOOR_DB);
  return 10 ** (db / 20);
}

/** The volume envelope's value, 0…1, that plays at `gain`: unity is 0 dB. */
export function volumeValue(gain: number): number {
  if (gain <= 0) {
    return 0;
  }
  const db = 20 * Math.log10(gain);
  return Math.min(
    1,
    Math.max(0, (db - VOLUME_FLOOR_DB) / (VOLUME_CEILING_DB - VOLUME_FLOOR_DB))
  );
}

/** A pan envelope's value, 0…1, as a pan from -1 (left) to 1 (right). */
export const panPosition = (value: number) =>
  Math.min(1, Math.max(-1, value * 2 - 1));

/** Where a parameter's envelope starts when it is first drawn: the mix's value, flat. */
export function flatAutomation(value: number): Breakpoint[] {
  return [
    { x: 0, y: value },
    { x: 1, y: value },
  ];
}

/**
 * An envelope's value at `x`, 0…1 of the arrangement: along the curve of the
 * segment it falls in, the first point's value before it, the last's after.
 */
export function automationAt(points: readonly Breakpoint[], x: number): number {
  const [first] = points;
  if (!first) {
    return 0;
  }
  if (x <= first.x) {
    return first.y;
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index] as Breakpoint;
    const to = points[index + 1] as Breakpoint;
    if (x < to.x) {
      const span = to.x - from.x;
      return span > 0 ? levelAt(from, to, (x - from.x) / span) : to.y;
    }
  }
  return (points.at(-1) as Breakpoint).y;
}

/**
 * Where each automated device parameter of a track stands at `x`, 0…1 of the
 * arrangement, as a position along its travel from 0 to 1, by device then
 * parameter; one a change by hand has `overridden` plays as it is set.
 */
export function devicePositions(
  track: ArrangementTrack,
  x: number,
  overridden: readonly AutomatedParameter[] = []
): Map<string, Map<string, number>> {
  const positions = new Map<string, Map<string, number>>();
  for (const [key, points] of Object.entries(track.automation ?? {})) {
    const named = parseDeviceParameter(key);
    if (
      !(named && points && points.length > 0) ||
      overridden.includes(key as AutomatedParameter)
    ) {
      continue;
    }
    const parameters = positions.get(named.device) ?? new Map();
    parameters.set(named.parameter, automationAt(points, x));
    positions.set(named.device, parameters);
  }
  return positions;
}

/** The fade a clip laid down gets at each edge, in seconds: enough to take the click off a cut. */
export const EDGE_FADE_SECONDS = 0.004;

/** A clip's fades as it is laid down: `EDGE_FADE_SECONDS` at each edge, or half its length when it is shorter. */
export function withEdgeFades<Value extends { length: number }>(
  value: Value
): Value & { fadeIn: number; fadeOut: number } {
  const fade = Math.min(EDGE_FADE_SECONDS, value.length / 2);
  return { ...value, fadeIn: fade, fadeOut: fade };
}

/** What a recording's beat is read as when it comes in: its tempo, if it has one, and its transients, in seconds. */
export interface BeatAnalysis {
  estimate: TempoEstimate | null;
  transients: number[];
}

/** Reads a recording's beat, once, as it is decoded: what `warpOnImport` warps its clips by. */
export function analyzeBeat(
  channels: readonly Float32Array[],
  sampleRate: number
): BeatAnalysis {
  const estimate = estimateTempo(channels, sampleRate);
  return {
    estimate,
    transients: estimate ? detectTransients(channels, sampleRate) : [],
  };
}

/**
 * A clip of a recording just brought in, warped in Beats so it plays in time
 * at `tempo` (CLP-019): a short loop as that loop, any other on the first
 * beat of each bar, starting on its first beat and as long as the whole
 * recording plays. A recording with no tempo leaves the clip as it is.
 */
export function warpOnImport<Clip extends Arranged>(
  clip: Clip,
  beat: BeatAnalysis,
  tempo: { beatsPerBar: number; bpm: number }
): Clip {
  const warped = autoWarp({
    beatsPerBar: tempo.beatsPerBar,
    duration: clip.sourceLength,
    estimate: beat.estimate,
    tempo: tempo.bpm,
    transients: beat.transients,
  });
  if (!warped) {
    return clip;
  }
  const length = warpedTime(warped.warp, clip.sourceLength) - warped.offset;
  return {
    ...clip,
    value: { ...clip.value, length, offset: warped.offset },
    warp: warped.warp,
    warpMode: "beats",
  };
}

/**
 * A track's played clips with their crossfades: two that meet with fades of
 * one length play through each other. Each goes on past the join by as much as
 * both sources hold, up to that length, and both fade over the same stretch
 * around it, so what they share stays level, and a clip cut in two plays on as
 * if it were whole. With nothing to play past the join, they keep their own
 * fades. `played` is in the order the clips start.
 */
export function withCrossfades(played: readonly PlayedClip[]): PlayedClip[] {
  const clips = [...played];
  for (let index = 1; index < clips.length; index += 1) {
    const left = clips[index - 1] as PlayedClip;
    const right = clips[index] as PlayedClip;
    if (
      Math.abs(left.end - right.start) <= 1 &&
      Math.abs(left.fadeOut - right.fadeIn) <= 1 &&
      left.fadeOut > 0
    ) {
      const after = left.loop
        ? left.fadeOut
        : left.span - (left.end + left.shift);
      const before = right.start + right.shift;
      const half = Math.floor(Math.min(left.fadeOut, after, before));
      if (half > 0) {
        clips[index - 1] = {
          ...left,
          end: left.end + half,
          fadeOut: half * 2,
        };
        clips[index] = {
          ...right,
          fadeIn: half * 2,
          start: right.start - half,
        };
      }
    }
  }
  return clips;
}

/** A rack with each macro an envelope moves where `turned` has it, by its parameter id. */
export function rackWithMacros(
  rack: Rack,
  turned: ReadonlyMap<string, number> | undefined
): Rack {
  if (!turned) {
    return rack;
  }
  return {
    ...rack,
    macros: rack.macros.map((macro, index) => {
      const value = turned.get(`macro-${index + 1}`);
      return value === undefined ? macro : { ...macro, value };
    }),
  };
}

/** A track's automation without the envelopes of the devices `gone`; the same one when it had none of theirs. */
export function withoutDeviceAutomation(
  automation: TrackAutomation | undefined,
  gone: ReadonlySet<string>
): TrackAutomation | undefined {
  if (!automation) {
    return automation;
  }
  const kept = Object.entries(automation).filter(([key]) => {
    const named = parseDeviceParameter(key);
    return !(named && gone.has(named.device));
  });
  return kept.length === Object.keys(automation).length
    ? automation
    : (Object.fromEntries(kept) as TrackAutomation);
}

/**
 * A track's gain and pan at `x`, 0…1 of the arrangement: its envelopes where
 * it has them, its mix where it has none or where a change by hand has
 * `overridden` them, until the automation is enabled again.
 */
export function mixAt(
  track: ArrangementTrack,
  mix: Mix,
  x: number,
  overridden: readonly AutomatedParameter[] = []
): { gain: number; pan: number } {
  const followed = (parameter: AutomatedParameter) =>
    overridden.includes(parameter) ? undefined : track.automation?.[parameter];
  const volume = followed("volume");
  const pan = followed("pan");
  return {
    gain: volume ? volumeGain(automationAt(volume, x)) : mix.gain,
    pan: pan ? panPosition(automationAt(pan, x)) : mix.pan,
  };
}
