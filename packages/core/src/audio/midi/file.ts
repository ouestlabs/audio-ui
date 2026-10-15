/**
 * Standard MIDI Files (SMF 1.0, format 0, 1 and 2): reading a file into
 * notes, tempos and time signatures, and writing notes back as a format 0
 * file. A file is read as a stream of delta-time and event pairs inside
 * `MTrk` chunks after an `MThd` header; a malformed file raises a
 * `MidiFileError` that says what is wrong.
 */

/** Raised for a file that is not a Standard MIDI File, is cut short, or uses what is not supported. */
export class MidiFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MidiFileError";
  }
}

/** A note-on and its note-off as one note, in ticks: converting ticks to seconds is left to whoever knows the tempo map. */
export interface MidiFileNote {
  /** 0 to 15. */
  channel: number;
  durationTicks: number;
  /** MIDI note number, 0 to 127: 60 is middle C. */
  note: number;
  startTick: number;
  /** Index of the track chunk the note came from, in file order. */
  track: number;
  /** 0 to 1, from the note-on's 1 to 127. */
  velocity: number;
}

/** A Set Tempo event: how long a quarter note lasts from `tick` on. */
export interface MidiFileTempo {
  microsecondsPerQuarterNote: number;
  tick: number;
}

/** A Time Signature event: `numerator` over `denominator`, from `tick` on. */
export interface MidiFileTimeSignature {
  /** The note value of a beat: 4 for quarter notes, 8 for eighths. */
  denominator: number;
  numerator: number;
  tick: number;
}

export interface ParsedMidiFile {
  /** 0: one track; 1: simultaneous tracks; 2: independent sequences, whose notes are merged here. */
  format: number;
  /** Microseconds per quarter note of the first Set Tempo, or 500000 (120 BPM, the spec's default) when there is none. */
  microsecondsPerQuarterNote: number;
  /** Every note of every track, by start tick, then channel, then pitch. */
  notes: MidiFileNote[];
  /** Every Set Tempo of the file, by tick: a song with a tempo map has several. */
  tempos: MidiFileTempo[];
  ticksPerQuarterNote: number;
  timeSignatures: MidiFileTimeSignature[];
}

const HEADER_ID = "MThd";
const TRACK_ID = "MTrk";
const HEADER_MIN_LENGTH = 6;
const DEFAULT_TICKS_PER_QUARTER_NOTE = 480;
/** 120 BPM: the tempo of a file with no Set Tempo event. */
const DEFAULT_MICROSECONDS_PER_QUARTER_NOTE = 500_000;
const MICROSECONDS_PER_MINUTE = 60_000_000;
const MAX_MICROSECONDS_PER_QUARTER_NOTE = 0xff_ff_ff;
const SMPTE_DIVISION_BIT = 0x80_00;
const MAX_TICKS_PER_QUARTER_NOTE = 0x7f_ff;

const STATUS_MASK = 0xf0;
const CHANNEL_MASK = 0x0f;
const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const PROGRAM_CHANGE = 0xc0;
const CHANNEL_PRESSURE = 0xd0;
const SYSEX = 0xf0;
const SYSEX_ESCAPE = 0xf7;
const META = 0xff;
const META_END_OF_TRACK = 0x2f;
const META_SET_TEMPO = 0x51;
const META_TIME_SIGNATURE = 0x58;
const VLQ_CONTINUE = 0x80;
const VLQ_DATA = 0x7f;
/** A variable-length quantity is at most four bytes: 28 bits. */
const VLQ_MAX_BYTES = 4;
const VLQ_MAX = 0x0f_ff_ff_ff;
const MAX_DATA_BYTE = 127;

/** Reads bytes in order, failing with a `MidiFileError` where a read would pass the end. */
class ByteReader {
  readonly #bytes: Uint8Array;
  #offset = 0;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  get position() {
    return this.#offset;
  }

  get length() {
    return this.#bytes.length;
  }

  #need(count: number) {
    if (this.#offset + count > this.#bytes.length) {
      throw new MidiFileError(
        "The file ends in the middle of a chunk or an event."
      );
    }
  }

  uint8() {
    this.#need(1);
    const value = this.#bytes[this.#offset] ?? 0;
    this.#offset += 1;
    return value;
  }

  peek() {
    this.#need(1);
    return this.#bytes[this.#offset] ?? 0;
  }

  uint16() {
    return (this.uint8() << 8) | this.uint8();
  }

  uint32() {
    return this.uint16() * 0x1_00_00 + this.uint16();
  }

  ascii(count: number) {
    this.#need(count);
    let text = "";
    for (let index = 0; index < count; index += 1) {
      text += String.fromCharCode(this.uint8());
    }
    return text;
  }

  skip(count: number) {
    this.#need(count);
    this.#offset += count;
  }

  /** A variable-length quantity: seven bits a byte, the high bit set on every byte but the last. */
  variableLength() {
    let value = 0;
    for (let byte = 0; byte < VLQ_MAX_BYTES; byte += 1) {
      const next = this.uint8();
      value = (value << 7) | (next & VLQ_DATA);
      if (!(next & VLQ_CONTINUE)) {
        return value;
      }
    }
    throw new MidiFileError(
      "A delta time or a length is more than four bytes long."
    );
  }
}

interface OpenNote {
  startTick: number;
  velocity: number;
}

interface TrackState {
  /** Notes sounding, per channel and note, oldest first: a note struck again before it is released is a second note. */
  open: Map<number, OpenNote[]>;
  /** The status of the last channel event, reused by an event that starts with a data byte. Cancelled by sysex and meta events. */
  runningStatus: number | null;
  tick: number;
}

interface TrackResult {
  notes: MidiFileNote[];
  tempos: MidiFileTempo[];
  timeSignatures: MidiFileTimeSignature[];
}

function closeNote(
  state: TrackState,
  channel: number,
  note: number,
  tick: number,
  track: number,
  notes: MidiFileNote[]
) {
  const key = (channel << 7) | note;
  const stack = state.open.get(key);
  const opened = stack?.shift();
  if (!opened) {
    return;
  }
  if (stack?.length === 0) {
    state.open.delete(key);
  }
  notes.push({
    channel,
    // A note-off on the tick of its note-on still sounds: at least one tick.
    durationTicks: Math.max(1, tick - opened.startTick),
    note,
    startTick: opened.startTick,
    track,
    velocity: opened.velocity,
  });
}

function readChannelEvent(
  reader: ByteReader,
  state: TrackState,
  status: number,
  track: number,
  notes: MidiFileNote[]
) {
  const command = status & STATUS_MASK;
  const channel = status & CHANNEL_MASK;
  const first = reader.uint8();
  const hasSecond = command !== PROGRAM_CHANGE && command !== CHANNEL_PRESSURE;
  const second = hasSecond ? reader.uint8() : 0;
  if (first > MAX_DATA_BYTE || second > MAX_DATA_BYTE) {
    throw new MidiFileError("A channel event has a data byte over 127.");
  }
  if (command === NOTE_ON && second > 0) {
    const key = (channel << 7) | first;
    const stack = state.open.get(key) ?? [];
    stack.push({ startTick: state.tick, velocity: second / MAX_DATA_BYTE });
    state.open.set(key, stack);
  } else if (command === NOTE_ON || command === NOTE_OFF) {
    closeNote(state, channel, first, state.tick, track, notes);
  }
}

function readMetaEvent(
  reader: ByteReader,
  state: TrackState,
  result: TrackResult
): boolean {
  const type = reader.uint8();
  const length = reader.variableLength();
  if (type === META_SET_TEMPO && length === 3) {
    result.tempos.push({
      microsecondsPerQuarterNote:
        (reader.uint8() << 16) | (reader.uint8() << 8) | reader.uint8(),
      tick: state.tick,
    });
  } else if (type === META_TIME_SIGNATURE && length >= 2) {
    const numerator = reader.uint8();
    const power = reader.uint8();
    reader.skip(length - 2);
    result.timeSignatures.push({
      denominator: 2 ** power,
      numerator,
      tick: state.tick,
    });
  } else {
    reader.skip(length);
  }
  return type === META_END_OF_TRACK;
}

function readTrack(
  reader: ByteReader,
  end: number,
  track: number
): TrackResult {
  const result: TrackResult = { notes: [], tempos: [], timeSignatures: [] };
  const state: TrackState = { open: new Map(), runningStatus: null, tick: 0 };
  while (reader.position < end) {
    state.tick += reader.variableLength();
    let status = reader.peek();
    if (status & VLQ_CONTINUE) {
      reader.uint8();
    } else if (state.runningStatus === null) {
      throw new MidiFileError(
        "An event starts with a data byte where no running status applies."
      );
    } else {
      status = state.runningStatus;
    }
    if (status === META) {
      // Sysex and meta events cancel the running status, and cannot use one.
      state.runningStatus = null;
      if (readMetaEvent(reader, state, result)) {
        break;
      }
    } else if (status === SYSEX || status === SYSEX_ESCAPE) {
      state.runningStatus = null;
      reader.skip(reader.variableLength());
    } else if (status >= SYSEX) {
      throw new MidiFileError(
        `Status byte 0x${status.toString(16)} is not valid in a file.`
      );
    } else {
      state.runningStatus = status;
      readChannelEvent(reader, state, status, track, result.notes);
    }
  }
  // A note never released ends with its track.
  for (const [key, stack] of state.open) {
    for (const opened of stack) {
      result.notes.push({
        channel: key >> 7,
        durationTicks: Math.max(1, state.tick - opened.startTick),
        note: key & MAX_DATA_BYTE,
        startTick: opened.startTick,
        track,
        velocity: opened.velocity,
      });
    }
  }
  return result;
}

/**
 * Reads a Standard MIDI File. Notes of every track are merged and ordered by
 * start tick; each keeps the `track` it came from. Tempo and time signature
 * events are returned as lists, since a song may change both. Throws a
 * `MidiFileError` for a file that is not MIDI, is truncated or malformed, or
 * counts time in SMPTE frames, which this does not convert.
 */
export function parseMidiFile(file: ArrayBuffer | Uint8Array): ParsedMidiFile {
  const reader = new ByteReader(
    file instanceof Uint8Array ? file : new Uint8Array(file)
  );
  if (reader.length < 14 || reader.ascii(4) !== HEADER_ID) {
    throw new MidiFileError("Not a Standard MIDI File: no MThd header.");
  }
  const headerLength = reader.uint32();
  if (headerLength < HEADER_MIN_LENGTH) {
    throw new MidiFileError("The MThd header is shorter than six bytes.");
  }
  const format = reader.uint16();
  const trackCount = reader.uint16();
  const division = reader.uint16();
  // Programs should skip what a later version of the format adds to the header.
  reader.skip(headerLength - HEADER_MIN_LENGTH);
  if (division & SMPTE_DIVISION_BIT) {
    throw new MidiFileError(
      "This file counts time in SMPTE frames, which is not supported."
    );
  }
  if (division === 0) {
    throw new MidiFileError("The file has no ticks per quarter note.");
  }

  const notes: MidiFileNote[] = [];
  const tempos: MidiFileTempo[] = [];
  const timeSignatures: MidiFileTimeSignature[] = [];
  let track = 0;
  for (
    let chunk = 0;
    chunk < trackCount && reader.position < reader.length;
    chunk += 1
  ) {
    const id = reader.ascii(4);
    const length = reader.uint32();
    // A chunk that is not a track is skipped, as the spec asks.
    if (id !== TRACK_ID) {
      reader.skip(length);
      continue;
    }
    const end = reader.position + length;
    const result = readTrack(reader, end, track);
    if (reader.position > end) {
      throw new MidiFileError("An event runs past the end of its track.");
    }
    // Bytes after the End of Track belong to the chunk, and are skipped.
    reader.skip(end - reader.position);
    for (const note of result.notes) {
      notes.push(note);
    }
    for (const tempo of result.tempos) {
      tempos.push(tempo);
    }
    for (const signature of result.timeSignatures) {
      timeSignatures.push(signature);
    }
    track += 1;
  }

  // Notes that start together are ordered by channel and pitch, so the order is the same for a file whichever order its events were written in.
  notes.sort(
    (a, b) =>
      a.startTick - b.startTick || a.channel - b.channel || a.note - b.note
  );
  tempos.sort((a, b) => a.tick - b.tick);
  timeSignatures.sort((a, b) => a.tick - b.tick);
  return {
    format,
    microsecondsPerQuarterNote:
      tempos[0]?.microsecondsPerQuarterNote ??
      DEFAULT_MICROSECONDS_PER_QUARTER_NOTE,
    notes,
    tempos,
    ticksPerQuarterNote: division,
    timeSignatures,
  };
}

export interface EncodeMidiFileOptions {
  /** Beats per minute: from about 4 up, since a tempo is stored as microseconds per quarter note in three bytes. */
  bpm: number;
  notes: readonly Omit<MidiFileNote, "track">[];
  /** @default 480 */
  ticksPerQuarterNote?: number;
}

function pushVariableLength(bytes: number[], value: number) {
  if (!Number.isInteger(value) || value < 0 || value > VLQ_MAX) {
    throw new MidiFileError(
      `A time of ${value} ticks does not fit in a MIDI file.`
    );
  }
  const groups = [value & VLQ_DATA];
  let rest = value >>> 7;
  while (rest > 0) {
    groups.unshift((rest & VLQ_DATA) | VLQ_CONTINUE);
    rest >>>= 7;
  }
  for (const byte of groups) {
    bytes.push(byte);
  }
}

const clampByte = (value: number) =>
  Math.min(MAX_DATA_BYTE, Math.max(0, Math.round(value)));

interface EncodedEvent {
  bytes: number[];
  /** A note-off sorts before a note-on of the same tick, so a note that ends where the next begins is not cut. */
  order: number;
  tick: number;
}

/** Writes notes as a format 0 file: one track, a Set Tempo, the notes and an End of Track. Throws a `MidiFileError` for a tempo or a time that does not fit. */
export function encodeMidiFile({
  bpm,
  notes,
  ticksPerQuarterNote = DEFAULT_TICKS_PER_QUARTER_NOTE,
}: EncodeMidiFileOptions): Uint8Array {
  if (
    !Number.isInteger(ticksPerQuarterNote) ||
    ticksPerQuarterNote < 1 ||
    ticksPerQuarterNote > MAX_TICKS_PER_QUARTER_NOTE
  ) {
    throw new MidiFileError(
      "Ticks per quarter note is a whole number from 1 to 32767."
    );
  }
  const tempo = Math.round(MICROSECONDS_PER_MINUTE / bpm);
  if (
    !(Number.isFinite(tempo) && tempo > 0) ||
    tempo > MAX_MICROSECONDS_PER_QUARTER_NOTE
  ) {
    throw new MidiFileError(
      `A tempo of ${bpm} BPM does not fit in a MIDI file.`
    );
  }

  const events: EncodedEvent[] = [
    {
      bytes: [
        META,
        META_SET_TEMPO,
        3,
        (tempo >> 16) & 0xff,
        (tempo >> 8) & 0xff,
        tempo & 0xff,
      ],
      order: 0,
      tick: 0,
    },
  ];
  for (const note of notes) {
    const channel = note.channel & CHANNEL_MASK;
    const key = clampByte(note.note);
    const velocity = Math.max(1, clampByte(note.velocity * MAX_DATA_BYTE));
    const start = Math.round(note.startTick);
    events.push(
      { bytes: [NOTE_ON | channel, key, velocity], order: 1, tick: start },
      {
        bytes: [NOTE_OFF | channel, key, 0],
        order: 0,
        tick: start + Math.max(1, Math.round(note.durationTicks)),
      }
    );
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track: number[] = [];
  let previous = 0;
  for (const event of events) {
    pushVariableLength(track, event.tick - previous);
    for (const byte of event.bytes) {
      track.push(byte);
    }
    previous = event.tick;
  }
  track.push(0, META, META_END_OF_TRACK, 0);

  const header = [
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    (ticksPerQuarterNote >> 8) & 0xff,
    ticksPerQuarterNote & 0xff,
  ];
  const { length } = track;
  const out = new Uint8Array(header.length + 8 + length);
  out.set(header, 0);
  out.set([0x4d, 0x54, 0x72, 0x6b], header.length);
  out.set(
    [
      (length >>> 24) & 0xff,
      (length >>> 16) & 0xff,
      (length >>> 8) & 0xff,
      length & 0xff,
    ],
    header.length + 4
  );
  out.set(track, header.length + 8);
  return out;
}
