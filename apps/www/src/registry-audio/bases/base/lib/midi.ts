export type MidiEvent =
  | { note: number; type: "noteoff" }
  | { note: number; type: "noteon"; velocity: number }
  | { semitones: number; type: "pitchbend" };

const NOTE_ON_STATUS = 0x90;
const NOTE_OFF_STATUS = 0x80;
const PITCH_BEND_STATUS = 0xe0;
const STATUS_COMMAND_MASK = 0xf0;
const STATUS_CHANNEL_MASK = 0x0f;

const PITCH_BEND_DATA_BITS = 7;
/** 14-bit pitch bend is centered at 8192 (0-16383 range); dividing by this on both sides of center is the standard MIDI convention, accepting the slight asymmetry at the very top of the range. */
const PITCH_BEND_CENTER = 8192;
/** How many semitones a full bend (wheel at either extreme) shifts pitch by — ±2 semitones is the most common default across MIDI keyboards/synths. */
const PITCH_BEND_RANGE_SEMITONES = 2;

/** Parses a raw MIDI message into a note-on/note-off/pitch-bend event, or null for anything else (control change, clock, ...). A note-on with velocity 0 is a note-off, per the MIDI spec convention many keyboards use. */
export function parseMidiMessage(data: Uint8Array | null): MidiEvent | null {
  if (!data) {
    return null;
  }
  const [status, byte1, byte2] = data;
  if (status === undefined || byte1 === undefined) {
    return null;
  }
  const command = status & STATUS_COMMAND_MASK;
  if (command === NOTE_ON_STATUS) {
    return byte2
      ? { note: byte1, type: "noteon", velocity: byte2 }
      : { note: byte1, type: "noteoff" };
  }
  if (command === NOTE_OFF_STATUS) {
    return { note: byte1, type: "noteoff" };
  }
  if (command === PITCH_BEND_STATUS) {
    if (byte2 === undefined) {
      return null;
    }
    const value = (byte2 << PITCH_BEND_DATA_BITS) | byte1;
    const normalized = (value - PITCH_BEND_CENTER) / PITCH_BEND_CENTER;
    return {
      semitones: normalized * PITCH_BEND_RANGE_SEMITONES,
      type: "pitchbend",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Standard MIDI File (.mid) import/export — a different layer from the
// real-time message parsing above (whole binary files instead of live 1-3
// byte messages), but sharing the same status-byte vocabulary, hence the
// same module.
// ---------------------------------------------------------------------------

/** A note-on/note-off pair already resolved into a single duration-bearing event, in ticks — the unit both `parseMidiFile` and `encodeMidiFile` trade in, leaving tick↔second/step conversion to the caller (who knows the target BPM/grid). */
export interface MidiFileNote {
  channel: number;
  durationTicks: number;
  note: number;
  startTick: number;
  /** 0-1, matching this codebase's own velocity convention (`Note.velocity`) rather than MIDI's raw 0-127. */
  velocity: number;
}

export interface ParsedMidiFile {
  /** Microseconds per quarter note — from the file's first Set Tempo meta event, or the MIDI default (500000, i.e. 120 BPM) when none is present. */
  microsecondsPerQuarterNote: number;
  notes: MidiFileNote[];
  ticksPerQuarterNote: number;
}

const HEADER_CHUNK_ID = "MThd";
const TRACK_CHUNK_ID = "MTrk";
const DEFAULT_TICKS_PER_QUARTER_NOTE = 480;
/** 500,000 µs/quarter note = 120 BPM, the MIDI spec's default tempo when a file has no Set Tempo event. */
const DEFAULT_MICROSECONDS_PER_QUARTER_NOTE = 500_000;
const MICROSECONDS_PER_MINUTE = 60_000_000;

const META_EVENT_STATUS = 0xff;
const SYSEX_START_STATUS = 0xf0;
const SYSEX_END_STATUS = 0xf7;
const SET_TEMPO_META_TYPE = 0x51;
const END_OF_TRACK_META_TYPE = 0x2f;
const SET_TEMPO_DATA_LENGTH = 3;
const VLQ_CONTINUATION_BIT = 0x80;
const VLQ_DATA_MASK = 0x7f;
const MIDI_VELOCITY_MAX = 127;

class ByteReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get position(): number {
    return this.offset;
  }

  atEnd(): boolean {
    return this.offset >= this.view.byteLength;
  }

  readUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    const value = this.view.getUint16(this.offset);
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    const value = this.view.getUint32(this.offset);
    this.offset += 4;
    return value;
  }

  readString(length: number): string {
    let result = "";
    for (let i = 0; i < length; i += 1) {
      result += String.fromCharCode(this.readUint8());
    }
    return result;
  }

  skip(length: number): void {
    this.offset += length;
  }

  /** A variable-length quantity: 7 data bits per byte, high bit set on every byte but the last. Used for delta-times and meta-event lengths throughout the format. */
  readVariableLength(): number {
    let value = 0;
    let byte: number;
    do {
      byte = this.readUint8();
      value = (value << 7) | (byte & VLQ_DATA_MASK);
    } while (byte & VLQ_CONTINUATION_BIT);
    return value;
  }
}

function writeVariableLength(value: number): number[] {
  let remaining = value;
  const bytes = [remaining & VLQ_DATA_MASK];
  remaining >>= 7;
  while (remaining > 0) {
    bytes.unshift((remaining & VLQ_DATA_MASK) | VLQ_CONTINUATION_BIT);
    remaining >>= 7;
  }
  return bytes;
}

interface TrackParseResult {
  microsecondsPerQuarterNote: number | null;
  notes: MidiFileNote[];
}

interface ResolvedStatus {
  isNewStatus: boolean;
  status: number;
}

/** Reads the next event's status byte, resolving running status: a byte with its high bit clear is actually the first data byte of a new event that reuses the previous event's status, so it gets rewound and the running status returned instead. */
function resolveEventStatus(
  reader: ByteReader,
  runningStatus: number | null
): ResolvedStatus {
  const byte = reader.readUint8();
  if (byte < 0x80) {
    reader.skip(-1);
    return { isNewStatus: false, status: runningStatus ?? byte };
  }
  return { isNewStatus: true, status: byte };
}

interface MetaEventResult {
  isEndOfTrack: boolean;
  tempo: number | null;
}

/** Reads a meta event's type/length/data, capturing its microseconds-per-quarter-note when it's the first Set Tempo event seen (`hasTempo` guards against a later one overriding it). */
function readMetaEvent(reader: ByteReader, hasTempo: boolean): MetaEventResult {
  const metaType = reader.readUint8();
  const length = reader.readVariableLength();
  let tempo: number | null = null;
  if (
    metaType === SET_TEMPO_META_TYPE &&
    length === SET_TEMPO_DATA_LENGTH &&
    !hasTempo
  ) {
    tempo =
      (reader.readUint8() << 16) |
      (reader.readUint8() << 8) |
      reader.readUint8();
  } else {
    reader.skip(length);
  }
  return { isEndOfTrack: metaType === END_OF_TRACK_META_TYPE, tempo };
}

/** Reads a note-on/note-off's two data bytes and, if this closes out a previously-opened note, returns the resolved duration-bearing note — null while a note is still pending (just opened, or an unmatched close). */
function readNoteEvent(
  reader: ByteReader,
  command: number,
  channel: number,
  tick: number,
  pendingNotes: Map<string, { startTick: number; velocity: number }>
): MidiFileNote | null {
  const note = reader.readUint8();
  const velocity = reader.readUint8();
  const key = `${channel}:${note}`;
  if (command === NOTE_ON_STATUS && velocity > 0) {
    pendingNotes.set(key, { startTick: tick, velocity });
    return null;
  }
  const pending = pendingNotes.get(key);
  if (!pending) {
    return null;
  }
  pendingNotes.delete(key);
  return {
    channel,
    durationTicks: Math.max(1, tick - pending.startTick),
    note,
    startTick: pending.startTick,
    velocity: pending.velocity / MIDI_VELOCITY_MAX,
  };
}

interface TrackWalkState {
  microsecondsPerQuarterNote: number | null;
  pendingNotes: Map<string, { startTick: number; velocity: number }>;
  runningStatus: number | null;
  tick: number;
}

/** Reads and dispatches exactly one event at the reader's current position, mutating `state` (tick, running status, pending tempo) in place. Returns a resolved note when this event closed one, `"end"` when it was the track's End of Track meta event, otherwise null. Split out of `parseTrackChunk` purely to keep that function's own cognitive complexity manageable — it's just a `while` loop around this. */
function readTrackEvent(
  reader: ByteReader,
  state: TrackWalkState
): MidiFileNote | "end" | null {
  state.tick += reader.readVariableLength();
  const resolved = resolveEventStatus(reader, state.runningStatus);
  if (resolved.isNewStatus) {
    state.runningStatus = resolved.status;
  }
  const { status } = resolved;

  if (status === META_EVENT_STATUS) {
    const meta = readMetaEvent(
      reader,
      state.microsecondsPerQuarterNote !== null
    );
    if (meta.tempo !== null) {
      state.microsecondsPerQuarterNote = meta.tempo;
    }
    return meta.isEndOfTrack ? "end" : null;
  }

  if (status === SYSEX_START_STATUS || status === SYSEX_END_STATUS) {
    reader.skip(reader.readVariableLength());
    return null;
  }

  const command = status & STATUS_COMMAND_MASK;
  const channel = status & STATUS_CHANNEL_MASK;

  if (command === NOTE_ON_STATUS || command === NOTE_OFF_STATUS) {
    return readNoteEvent(
      reader,
      command,
      channel,
      state.tick,
      state.pendingNotes
    );
  }

  // Any other channel message (control change, program change, pitch
  // bend, aftertouch, ...) — consume its data bytes and move on, this
  // codec only cares about notes and tempo.
  reader.skip(command === 0xc0 || command === 0xd0 ? 1 : 2);
  return null;
}

/** Walks one already-positioned track chunk (`reader.position` at its first event, `chunkEnd` at its last byte) and resolves it into notes plus the first Set Tempo event found, if any. */
function parseTrackChunk(
  reader: ByteReader,
  chunkEnd: number
): TrackParseResult {
  const notes: MidiFileNote[] = [];
  const state: TrackWalkState = {
    microsecondsPerQuarterNote: null,
    pendingNotes: new Map(),
    runningStatus: null,
    tick: 0,
  };

  while (reader.position < chunkEnd) {
    const result = readTrackEvent(reader, state);
    if (result === "end") {
      break;
    }
    if (result) {
      notes.push(result);
    }
  }

  return {
    microsecondsPerQuarterNote: state.microsecondsPerQuarterNote,
    notes,
  };
}

/** Parses a Standard MIDI File (format 0, 1, or 2) into flat, duration-bearing notes merged across every track — this codebase has no notion of separate MIDI tracks/channels, just one polyphonic note list, so multi-track files are collapsed on import. */
export function parseMidiFile(buffer: ArrayBuffer): ParsedMidiFile {
  const reader = new ByteReader(buffer);

  if (reader.readString(4) !== HEADER_CHUNK_ID) {
    throw new Error("Not a Standard MIDI File (missing MThd header)");
  }
  reader.readUint32(); // header length, always 6
  reader.readUint16(); // format — unused, tracks are merged regardless
  const trackCount = reader.readUint16();
  const division = reader.readUint16();
  // Top bit set means SMPTE time code division, a frames/ticks-per-frame
  // scheme for film/video sync rather than musical ticks-per-quarter-note.
  // Real-world piano-roll exports essentially never use it; fall back to
  // the format's own default rather than trying to convert it.
  const ticksPerQuarterNote =
    division & 0x80_00 ? DEFAULT_TICKS_PER_QUARTER_NOTE : division;

  const notes: MidiFileNote[] = [];
  let microsecondsPerQuarterNote: number | null = null;

  for (let track = 0; track < trackCount && !reader.atEnd(); track += 1) {
    const chunkId = reader.readString(4);
    const chunkLength = reader.readUint32();
    const chunkEnd = reader.position + chunkLength;
    if (chunkId !== TRACK_CHUNK_ID) {
      reader.skip(chunkLength);
      continue;
    }

    const trackResult = parseTrackChunk(reader, chunkEnd);
    notes.push(...trackResult.notes);
    if (microsecondsPerQuarterNote === null) {
      ({ microsecondsPerQuarterNote } = trackResult);
    }
  }

  notes.sort((a, b) => a.startTick - b.startTick);

  return {
    microsecondsPerQuarterNote:
      microsecondsPerQuarterNote ?? DEFAULT_MICROSECONDS_PER_QUARTER_NOTE,
    notes,
    ticksPerQuarterNote,
  };
}

export interface EncodeMidiFileOptions {
  /** Beats per minute — converted internally to the Set Tempo meta event's microseconds-per-quarter-note. */
  bpm: number;
  notes: MidiFileNote[];
  ticksPerQuarterNote?: number;
}

/** Encodes a flat note list into a single-track (format 0) Standard MIDI File. */
export function encodeMidiFile(options: EncodeMidiFileOptions): Uint8Array {
  const ticksPerQuarterNote =
    options.ticksPerQuarterNote ?? DEFAULT_TICKS_PER_QUARTER_NOTE;
  const microsecondsPerQuarterNote = Math.round(
    MICROSECONDS_PER_MINUTE / options.bpm
  );

  type TrackEvent = {
    bytes: number[];
    tick: number;
    /** Note-offs before note-ons at the same tick, so a note ending exactly when another begins doesn't get truncated to zero length. */
    order: number;
  };
  const events: TrackEvent[] = [
    {
      bytes: [
        META_EVENT_STATUS,
        SET_TEMPO_META_TYPE,
        SET_TEMPO_DATA_LENGTH,
        (microsecondsPerQuarterNote >> 16) & 0xff,
        (microsecondsPerQuarterNote >> 8) & 0xff,
        microsecondsPerQuarterNote & 0xff,
      ],
      order: 0,
      tick: 0,
    },
  ];

  for (const note of options.notes) {
    const channel = note.channel & STATUS_CHANNEL_MASK;
    const velocity = Math.round(
      Math.max(0, Math.min(1, note.velocity)) * MIDI_VELOCITY_MAX
    );
    events.push({
      bytes: [NOTE_ON_STATUS | channel, note.note, Math.max(1, velocity)],
      order: 1,
      tick: note.startTick,
    });
    events.push({
      bytes: [NOTE_OFF_STATUS | channel, note.note, 0],
      order: 0,
      tick: note.startTick + note.durationTicks,
    });
  }

  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const trackBytes: number[] = [];
  let previousTick = 0;
  for (const event of events) {
    trackBytes.push(...writeVariableLength(event.tick - previousTick));
    trackBytes.push(...event.bytes);
    previousTick = event.tick;
  }
  trackBytes.push(0, META_EVENT_STATUS, END_OF_TRACK_META_TYPE, 0);

  const headerBytes = [
    ...Array.from(HEADER_CHUNK_ID, (c) => c.charCodeAt(0)),
    0,
    0,
    0,
    6, // header chunk length, always 6
    0,
    0, // format 0
    0,
    1, // ntrks = 1
    (ticksPerQuarterNote >> 8) & 0xff,
    ticksPerQuarterNote & 0xff,
  ];

  const trackLength = trackBytes.length;
  const trackChunkBytes = [
    ...Array.from(TRACK_CHUNK_ID, (c) => c.charCodeAt(0)),
    (trackLength >> 24) & 0xff,
    (trackLength >> 16) & 0xff,
    (trackLength >> 8) & 0xff,
    trackLength & 0xff,
    ...trackBytes,
  ];

  return new Uint8Array([...headerBytes, ...trackChunkBytes]);
}
