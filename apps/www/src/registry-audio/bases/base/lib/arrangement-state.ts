import type { Breakpoint } from "@audio-ui/core/envelope";
import {
  type SignatureChange,
  secondsPerBar,
  type Tempo,
} from "@audio-ui/core/time";
import {
  type ClipValue,
  copyRange,
  coverClips,
  duplicateClip,
  type FadeShape,
  insertTime,
  moveClip,
  removeTime,
  setClipFadeShape,
  splitClip,
  trimClipEnd,
} from "@audio-ui/react";
import {
  type Arranged,
  type ArrangementTrack,
  type AutomatedParameter,
  type ChainZone,
  type ClipAction,
  type Clipping,
  DRUM_RACK_DEVICE,
  type DrumSound,
  deviceParameterKey,
  FULL_ZONE,
  INSTRUMENT_RACK_DEVICE,
  type Mix,
  mixOf,
  newDrumRack,
  newRack,
  parseDeviceParameter,
  RACK_DEVICE,
  type Rack,
  type RackChain,
  type RackMacro,
  type RackMapping,
  rackDevices,
  type TimeSelection,
  type TrackAutomation,
  type TrackDevice,
  type TrackKind,
  withoutDeviceAutomation,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  beginChange,
  emptyHistory,
  type History,
  type HistoryStep,
  recordChange,
  redo,
  settleChange,
  undo,
} from "@/registry-audio/bases/base/lib/undo-history";

/**
 * A new id for a piece of the clip `id`: the first `-n` after it that no clip
 * in `taken` has. It is added to `taken`, so the next piece takes another.
 */
/** What a new track is called, by what it holds, before its number. */
const TRACK_NAMES: Record<TrackKind, string> = {
  audio: "Track",
  group: "Group",
  midi: "MIDI",
};

function freshId(id: string, taken: Set<string>): string {
  let n = 1;
  while (taken.has(`${id}-${n}`)) {
    n += 1;
  }
  const piece = `${id}-${n}`;
  taken.add(piece);
  return piece;
}

/**
 * The function that makes the second piece of a cut clip from the first, with
 * an id of its own no clip in `all` has.
 */
function splitter(all: readonly Arranged[]) {
  const taken = new Set(all.map((clip) => clip.id));
  return (item: Arranged, value: ClipValue): Arranged => ({
    ...item,
    id: freshId(item.id, taken),
    value,
  });
}

/**
 * Lays `placed` on its track: it covers what was under it, as a DAW's does,
 * rather than stacking on it. Pieces cut from a clip it lies inside get ids of
 * their own. Covering only shortens a clip, so the reach of `placed` has no
 * say in what is left of the others.
 */
export function lay(
  all: Arranged[],
  placed: Arranged,
  duration: number
): Arranged[] {
  const others = all.filter((clip) => clip.id !== placed.id);
  const onTrack = others.filter((clip) => clip.track === placed.track);
  const elsewhere = others.filter((clip) => clip.track !== placed.track);
  const covered = coverClips(
    onTrack,
    placed.value,
    { duration },
    splitter(all)
  );
  return [...elsewhere, ...covered, placed];
}

/** The track `shift` tracks away in `order`, kept on the arrangement. */
export function shiftTrack(
  order: readonly string[],
  track: string,
  shift: number
): string {
  const target = Math.min(
    order.length - 1,
    Math.max(0, order.indexOf(track) + shift)
  );
  return order[target] ?? track;
}

/** The rest of a selection that holds `id`: what a drop with no sideways move has no change event to have noted. */
export function otherSelected(selected: string[], id: string): string[] {
  return selected.length > 1 && selected.includes(id)
    ? selected.filter((other) => other !== id)
    : [];
}

export interface Landing {
  duration: number;
  /** The other clips of a dragged group. */
  group: string[];
  /** The clip that was dragged. */
  id: string;
  /** The track ids, top to bottom. */
  order: readonly string[];
  /** The originals of a copy drag, which stay where they were. */
  origins: Arranged[];
  /** The track the clip was dropped on, if it left its own. */
  track: string | undefined;
}

/**
 * Lays down what a drag moved: the dragged clip and its group land where they
 * were put, covering what they lie over; in a copy drag the originals stay
 * where they were, as copies of their own, under what was moved.
 */
export function land(all: Arranged[], landing: Landing): Arranged[] {
  const { duration, group, id, order, origins, track } = landing;
  const current = all.find((clip) => clip.id === id);
  if (!current) {
    return all;
  }
  const placed = track ? { ...current, track } : current;
  const movedIds = new Set([id, ...group]);
  // A group dropped on another track moves by as many tracks as the dragged clip did.
  const shift = track ? order.indexOf(track) - order.indexOf(current.track) : 0;
  const moved = all
    .filter((clip) => movedIds.has(clip.id))
    .map((clip) =>
      clip.id === id
        ? clip
        : { ...clip, track: shiftTrack(order, clip.track, shift) }
    );
  let laid = origins.length
    ? all.filter((clip) => !movedIds.has(clip.id))
    : all;
  const taken = new Set(all.map((clip) => clip.id));
  laid = origins.reduce(
    (kept, origin) =>
      lay(kept, { ...origin, id: freshId(origin.id, taken) }, duration),
    laid
  );
  for (const clip of origins.length ? moved : [placed]) {
    laid = lay(laid, clip.id === id ? placed : clip, duration);
  }
  // The rest of a dragged group lands too, covering what it lies over.
  if (!origins.length) {
    for (const other of group) {
      const grouped = moved.find((clip) => clip.id === other);
      if (grouped) {
        laid = lay(laid, grouped, duration);
      }
    }
  }
  return laid;
}

/** A clip's positions and lengths, all in seconds, scaled when the tempo changes. */
export function scaleValue(value: ClipValue, ratio: number): ClipValue {
  return {
    ...value,
    fadeIn: value.fadeIn * ratio,
    fadeOut: value.fadeOut * ratio,
    length: value.length * ratio,
    offset: value.offset * ratio,
    start: value.start * ratio,
  };
}

/**
 * A clip at a new tempo, every time of the song `ratio` times what it was. A
 * MIDI clip is in beats at heart: its place, its notes and its loop all
 * follow. A warped recording follows through its markers: its own times (its
 * place, its length, where it starts, its loop) and the markers' places on
 * it, while the recording itself stays as it is. A recording that is not
 * warped keeps its speed: only its start follows the bar, and it lasts as
 * many seconds as before.
 */
export function scaleClip(clip: Arranged, ratio: number): Arranged {
  if (!clip.notes) {
    if (!clip.warp) {
      return {
        ...clip,
        value: { ...clip.value, start: clip.value.start * ratio },
      };
    }
    return {
      ...clip,
      loop: clip.loop && [clip.loop[0] * ratio, clip.loop[1] * ratio],
      value: scaleValue(clip.value, ratio),
      warp: clip.warp.map((marker) => ({
        ...marker,
        target: marker.target * ratio,
      })),
    };
  }
  const scaled: Arranged = {
    ...clip,
    sourceLength: clip.sourceLength * ratio,
    value: scaleValue(clip.value, ratio),
  };
  return {
    ...scaled,
    loop: clip.loop && [clip.loop[0] * ratio, clip.loop[1] * ratio],
    notes: clip.notes.map((note) => ({
      ...note,
      length: note.length * ratio,
      start: note.start * ratio,
    })),
  };
}

/**
 * Clips that run into the next one on their track end where it starts, and
 * none runs past the end of the timeline: what a change of tempo can leave
 * when recordings keep their speed.
 */
export function settleOverlaps(all: Arranged[], duration: number): Arranged[] {
  const byStart = [...all].sort((a, b) => a.value.start - b.value.start);
  return all.map((clip) => {
    const next = byStart.find(
      (other) =>
        other.track === clip.track &&
        other.id !== clip.id &&
        other.value.start > clip.value.start
    );
    const end = Math.min(duration, next?.value.start ?? duration);
    return clip.value.start + clip.value.length > end
      ? { ...clip, value: trimClipEnd(clip.value, end, { duration }) }
      : clip;
  });
}

/** The parts of the clips in a stretch of time on some tracks, ready to paste. */
export function copyTime(
  all: Arranged[],
  { range: [from, to], tracks }: TimeSelection,
  order: readonly string[],
  duration: number
): Clipping {
  const rows = tracks.map((track) => order.indexOf(track));
  const first = Math.min(...rows);
  const parts = copyRange(
    all.filter((clip) => tracks.includes(clip.track)),
    from,
    to,
    { duration }
  ).map((part) => ({ ...part, row: order.indexOf(part.track) - first }));
  return { length: to - from, parts };
}

/** The selected clips, whole, ready to paste: their span from the first start to the last end. */
export function copyClips(
  chosen: Arranged[],
  order: readonly string[],
  duration: number
): Clipping {
  if (chosen.length === 0) {
    return { length: 0, parts: [] };
  }
  const from = Math.min(...chosen.map((clip) => clip.value.start));
  const to = Math.max(
    ...chosen.map((clip) => clip.value.start + clip.value.length)
  );
  return copyTime(
    chosen,
    {
      range: [from, to],
      tracks: [...new Set(chosen.map((clip) => clip.track))],
    },
    order,
    duration
  );
}

/** Empties a stretch of time on its tracks: what lies in it goes, the clips across its edges are cut there. */
export function clearTime(
  all: Arranged[],
  { range: [from, to], tracks }: TimeSelection,
  duration: number
): Arranged[] {
  const span = {
    fadeIn: 0,
    fadeOut: 0,
    length: to - from,
    offset: 0,
    start: from,
  };
  const onTracks = all.filter((clip) => tracks.includes(clip.track));
  return [
    ...all.filter((clip) => !tracks.includes(clip.track)),
    ...coverClips(onTracks, span, { duration }, splitter(all)),
  ];
}

/**
 * Lays a copy down at `at`, its first row on the track `track` and the rest
 * on the tracks below it (those that would fall off the bottom are left out),
 * covering what is there. Returns the arrangement and the ids of the new clips.
 */
export function pasteTime(
  all: Arranged[],
  clipping: Clipping,
  at: number,
  track: string,
  order: readonly string[],
  duration: number
): { clips: Arranged[]; ids: string[] } {
  const top = order.indexOf(track);
  let laid = all;
  const ids: string[] = [];
  const taken = new Set(all.map((clip) => clip.id));
  for (const part of clipping.parts) {
    const onto = order[top + part.row];
    const start = at + part.value.start;
    if (!onto || start >= duration) {
      continue;
    }
    const { row: _row, ...clip } = part;
    const length = Math.min(part.value.length, duration - start);
    const placed = {
      ...clip,
      id: freshId(part.id, taken),
      track: onto,
      value: { ...part.value, length, start },
    };
    ids.push(placed.id);
    laid = lay(laid, placed, duration);
  }
  return { clips: laid, ids };
}

/** Takes a stretch out of every track and closes the gap: what came after it moves back. */
export function deleteTime(
  all: Arranged[],
  from: number,
  to: number,
  duration: number
): Arranged[] {
  return removeTime(all, from, to, { duration }, splitter(all));
}

/** Opens a stretch `length` long at `at` on every track: what came after it moves later. */
export function openTime(
  all: Arranged[],
  at: number,
  length: number,
  duration: number
): Arranged[] {
  return insertTime(all, at, length, { duration }, splitter(all));
}

/**
 * Makes one clip per track of a stretch of time: on each track that has
 * anything in it, a clip spanning the stretch replaces what was there, named
 * after the first clip it takes in.
 */
export function consolidate(
  all: Arranged[],
  selection: TimeSelection,
  duration: number
): { clips: Arranged[]; ids: string[] } {
  const [from, to] = selection.range;
  const length = to - from;
  const taken = new Set(all.map((clip) => clip.id));
  const made = selection.tracks.flatMap((track) => {
    const [first] = all
      .filter(
        (clip) =>
          clip.track === track &&
          clip.value.start < to &&
          clip.value.start + clip.value.length > from
      )
      .sort((a, b) => a.value.start - b.value.start);
    return first
      ? [
          {
            ...first,
            disabled: false,
            id: freshId(first.id, taken),
            sourceLength: length,
            value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start: from },
          },
        ]
      : [];
  });
  const cleared = clearTime(all, selection, duration);
  return { clips: [...cleared, ...made], ids: made.map((clip) => clip.id) };
}

/** How close two edges are to count as touching, in the timeline's units. */
const TOUCHING = 1e-6;

/**
 * Gives the clip `id`'s fade at `edge` to the clip it touches there, on its
 * track: the fade-out of the clip that ends where it starts, or the fade-in
 * of the clip that starts where it ends, as long as it can be. Two clips that
 * meet then fade across their meeting point together.
 */
export function crossfade(
  all: Arranged[],
  id: string,
  edge: "in" | "out"
): Arranged[] {
  const clip = all.find((item) => item.id === id);
  if (!clip) {
    return all;
  }
  const { fadeIn, fadeOut, length, start } = clip.value;
  const meeting = edge === "in" ? start : start + length;
  const fade = edge === "in" ? fadeIn : fadeOut;
  return all.map((other) => {
    if (other.id === id || other.track !== clip.track) {
      return other;
    }
    const { value } = other;
    if (
      edge === "in" &&
      Math.abs(value.start + value.length - meeting) < TOUCHING
    ) {
      const fadeOutLength = Math.min(fade, value.length - value.fadeIn);
      return { ...other, value: { ...value, fadeOut: fadeOutLength } };
    }
    if (edge === "out" && Math.abs(value.start - meeting) < TOUCHING) {
      const fadeInLength = Math.min(fade, value.length - value.fadeOut);
      return { ...other, value: { ...value, fadeIn: fadeInLength } };
    }
    return other;
  });
}

/**
 * Fades made from a stretch of time on its tracks: a clip whose start it
 * covers fades in up to where the stretch ends (or the clip does), and one
 * whose end it covers fades out from where it begins. Across two clips that
 * meet, that is a crossfade.
 */
export function fadeTime(
  all: Arranged[],
  { range: [from, to], tracks }: TimeSelection
): Arranged[] {
  return all.map((clip) => {
    if (!tracks.includes(clip.track)) {
      return clip;
    }
    const { length, start } = clip.value;
    const end = start + length;
    let { fadeIn, fadeOut } = clip.value;
    if (from <= start && start < to) {
      fadeIn = Math.min(to, end) - start;
    }
    if (from < end && end <= to) {
      fadeOut = end - Math.max(from, start);
    }
    // Both from one stretch over a whole clip: they share its length.
    if (fadeIn + fadeOut > length) {
      const scale = length / (fadeIn + fadeOut);
      fadeIn *= scale;
      fadeOut *= scale;
    }
    return fadeIn === clip.value.fadeIn && fadeOut === clip.value.fadeOut
      ? clip
      : { ...clip, value: { ...clip.value, fadeIn, fadeOut } };
  });
}

/**
 * Cuts a clip's source down to what it plays: the loop when it has one, else
 * the stretch from where it starts to where it ends. The clip sounds the same,
 * and its source no longer holds what it never reached.
 */
export function cropClip(clip: Arranged): Arranged {
  const [from, to] = clip.loop ?? [
    clip.value.offset,
    clip.value.offset + clip.value.length,
  ];
  return {
    ...clip,
    loop: clip.loop ? [0, to - from] : undefined,
    sourceFrom: (clip.sourceFrom ?? 0) + from,
    sourceLength: to - from,
    value: { ...clip.value, offset: Math.max(0, clip.value.offset - from) },
  };
}

// --- State and commands: what a host holds, and the one function that changes it

/** A stretch of time, in seconds: from where it starts to where it ends. */
export type Span = readonly [number, number];

/** A named point of the arrangement to jump to, in seconds. */
export interface ArrangementLocator {
  at: number;
  /** Stays the same as it moves, so its button keeps the focus. */
  id: string;
  name: string;
}

/** A change of time signature, with an id that stays the same as it moves. */
export type ArrangementSignature = SignatureChange & { id: string };

/** The loop: the stretch that repeats, and whether playback repeats it. */
export interface ArrangementLoop {
  on: boolean;
  range: Span;
}

/**
 * What undo and redo move between: the tracks and the clips on them, and the
 * time they are laid out in. Every time in it is in seconds at its `tempo`, so
 * a step of the history stays right whatever the tempo is now.
 */
export interface ArrangementDoc {
  clips: Arranged[];
  /** The length of the timeline every clip is kept within, in seconds. */
  duration: number;
  locators: ArrangementLocator[];
  loop: ArrangementLoop;
  /** The track every other one goes to, and that goes to the output. */
  main: ArrangementTrack;
  /** The return tracks: what the tracks send to, after the tracks, before the main track. */
  returns: ArrangementTrack[];
  /** Changes of time signature along the song, in seconds; the tempo holds the one it starts in. */
  signatures: ArrangementSignature[];
  tempo: Tempo;
  tracks: ArrangementTrack[];
}

/** What is selected: some clips, or whole tracks by their headers. */
export interface ArrangementSelection {
  clips: string[];
  /** The tracks picked by their headers. */
  tracks: string[];
}

/** Where a clip drag acts: its whole body, or one of its edges and fades. */
export type ClipTarget =
  | "fade-in"
  | "fade-out"
  | "move"
  | "trim-end"
  | "trim-start";

/** A change to a clip, as a drag or a key reports it. */
export interface ClipChange {
  /** Whether Alt was held: the clip is meant to be copied to where it lands. */
  copy?: boolean;
  /** For a move: how far the clip moved from where the drag began, in the timeline's units. */
  delta?: number;
  target: ClipTarget;
}

export interface ArrangementState {
  /** How many colors a track can take: new tracks cycle through them. */
  colors: number;
  doc: ArrangementDoc;
  /** A drag in progress: the clips a copy drag copies, and the group the dragged clip belongs to. */
  gesture: {
    copying: Arranged[] | null;
    group: Map<string, Arranged> | null;
  };
  history: History<ArrangementDoc>;
  selection: ArrangementSelection | null;
  /** How many tracks have been added: the next one takes the number after it. */
  trackCount: number;
}

/** The main track a new arrangement starts with. */
export const MAIN_TRACK: ArrangementTrack = {
  color: 0,
  id: "main",
  name: "Main",
};

export function createArrangementState({
  colors,
  duration,
  initialClips = [],
  initialLocators = [],
  initialLoop = { on: false, range: [0, 0] },
  initialMain = MAIN_TRACK,
  initialReturns = [],
  initialSignatures = [],
  initialTracks,
  tempo,
}: {
  colors: number;
  duration: number;
  initialClips?: Arranged[];
  initialLocators?: ArrangementLocator[];
  initialLoop?: ArrangementLoop;
  initialMain?: ArrangementTrack;
  initialReturns?: ArrangementTrack[];
  initialSignatures?: ArrangementSignature[];
  initialTracks: ArrangementTrack[];
  tempo: Tempo;
}): ArrangementState {
  return {
    colors,
    doc: {
      clips: initialClips,
      duration,
      locators: initialLocators,
      loop: initialLoop,
      main: initialMain,
      returns: initialReturns,
      signatures: initialSignatures,
      tempo,
      tracks: initialTracks,
    },
    gesture: { copying: null, group: null },
    history: emptyHistory(),
    selection: null,
    trackCount: initialTracks.length,
  };
}

/** Every change the arrangement takes, as a plain value. */
export type ArrangementCommand =
  | { type: "add-clip"; clip: Arranged }
  /**
   * Several commands as one step of undo, in order, each seeing what the one
   * before it did: what one gesture that makes several changes sends, such as
   * files dropped on the add-track row (a track, its name and its clip for
   * each).
   */
  | { type: "batch"; commands: readonly ArrangementCommand[] }
  // Time: the tempo, the signatures, the locators and the loop.
  | { type: "add-locator"; at: number }
  | { type: "add-signature"; at: number }
  /** A drag of the loop: a burst, which `settle-clip-edit` closes into one step. */
  | { type: "change-loop"; range: Span }
  /** A drag of a header's gain or pan: a burst, which `settle-clip-edit` closes into one step. */
  | { type: "change-mix"; id: string; patch: Partial<Omit<Mix, "color">> }
  | { type: "move-locator"; id: string; to: number }
  | { type: "move-signature"; id: string; to: number }
  | { type: "remove-locator"; id: string }
  | { type: "remove-signature"; id: string }
  | { type: "rename-locator"; id: string; name: string }
  | { type: "set-loop"; loop: Partial<ArrangementLoop> }
  | { type: "set-mix"; id: string; patch: Partial<Omit<Mix, "color">> }
  | { type: "set-track-color"; id: string; color: number }
  | {
      type: "set-signature";
      id: string;
      beatsPerBar: number;
      beatUnit: number;
    }
  /** Keeps the musical positions: everything is scaled to the new bar. */
  | { type: "set-tempo"; tempo: Tempo }
  /**
   * A track, after `afterId` or after the others; a return track goes among
   * the returns. `name` names it, as a file dropped to make it does; `id` is
   * the id it takes when no track has it yet, so a `batch` can put clips on it.
   */
  | {
      type: "add-track";
      afterId?: string;
      id?: string;
      kind?: TrackKind | "return";
      name?: string;
    }
  // Devices: a track's chain, by the track's id (a track, a return or the main track).
  /** Puts a device on a track's chain at `index` (its end when there is none). An instrument goes first on a MIDI track, in place of the one there was, and on no other track. */
  | {
      type: "add-device";
      track: string;
      device: string;
      instrument?: boolean;
      state: TrackDevice["state"];
      index?: number;
      /** A chain of a rack on the track to put it on, instead of the track's own chain. */
      chain?: { chain: string; rack: string };
    }
  // Racks: by the rack's device id on a track's chain.
  /** Puts the effects `ids` of a track's chain into a new rack, one chain of them, where the first was. */
  | { type: "group-devices"; track: string; ids: readonly string[] }
  /** Adds an empty chain to a rack. */
  | { type: "add-rack-chain"; track: string; rack: string }
  | { type: "remove-rack-chain"; track: string; rack: string; chain: string }
  /** A chain's name or mix, as a drag of its fader sets it: a burst, which `settle-clip-edit` closes into one step. */
  | {
      type: "change-rack-chain";
      track: string;
      rack: string;
      chain: string;
      name?: string;
      mix?: Partial<NonNullable<RackChain["mix"]>>;
      /** Its keys or its velocities, as a drag of a zone's slider sets them. */
      zone?: Partial<ChainZone>;
    }
  /** A turn of a macro, 0 to 1: a burst, which `settle-clip-edit` closes into one step. */
  | {
      type: "set-macro";
      track: string;
      rack: string;
      index: number;
      value: number;
    }
  // Drum racks: a pad is a chain of the rack, found by its id or by the note it answers.
  /** Puts `sound` on the pad of `note`: the chain already there takes it, or a new chain named `name` does. */
  | {
      type: "set-pad";
      track: string;
      rack: string;
      note: number;
      sound: DrumSound;
      name?: string;
    }
  /** A pad's pitch or decay, as a turn of its knob sets it: a burst, which `settle-clip-edit` closes into one step. */
  | {
      type: "change-pad";
      track: string;
      rack: string;
      chain: string;
      tune?: number;
      decay?: number;
    }
  /** Moves a pad to the note `note`; the pad there, if any, takes the note it had. */
  | {
      type: "move-pad";
      track: string;
      rack: string;
      chain: string;
      note: number;
    }
  /** Maps a parameter of a device inside the rack to a macro, over a stretch of its travel; mapped again, its stretch changes. */
  | {
      type: "map-macro";
      track: string;
      rack: string;
      index: number;
      mapping: RackMapping;
    }
  | {
      type: "unmap-macro";
      track: string;
      rack: string;
      index: number;
      device: string;
      parameter: string;
    }
  /** A turn of a device's knob: a burst, which `settle-clip-edit` closes into one step. */
  | {
      type: "change-device";
      track: string;
      id: string;
      state: TrackDevice["state"];
    }
  /** Moves a device along its chain, or to another track's chain with `to`. */
  | {
      type: "move-device";
      track: string;
      id: string;
      index: number;
      to?: string;
      /** A chain of a rack on the track the device moves along, instead of the track's own chain. */
      chain?: { chain: string; rack: string };
    }
  | { type: "remove-device"; track: string; id: string }
  | {
      type: "set-device";
      track: string;
      id: string;
      state: TrackDevice["state"];
    }
  /** Switches a device on or off. */
  | { type: "toggle-device"; track: string; id: string }
  // Sends: how much a track sends to a return, as a gain from 0 to 1.
  /** A drag of a send: a burst, which `settle-clip-edit` closes into one step. */
  | { type: "change-send"; track: string; to: string; level: number }
  | { type: "set-send"; track: string; to: string; level: number }
  /** Whether a return takes what is sent to it before the senders' volume, pan and switch. */
  | { type: "set-send-mode"; id: string; pre: boolean }
  | {
      type: "change-automation";
      trackId: string;
      parameter: AutomatedParameter;
      points: readonly Breakpoint[] | null;
    }
  | { type: "change-clip"; id: string; value: ClipValue; details: ClipChange }
  | {
      type: "clip-action";
      action: ClipAction;
      id: string;
      /** Where a split cuts, and the shortest piece it may leave. */
      at: number;
      step: number;
    }
  | {
      type: "commit-clip";
      id: string;
      copy: boolean;
      /** The track the clip was dropped on, if it left its own. */
      track: string | undefined;
    }
  | { type: "consolidate-time"; time: TimeSelection }
  | { type: "clear-selection" }
  | { type: "clear-time"; time: TimeSelection }
  | { type: "crop-clip"; id: string }
  | { type: "duplicate-selection" }
  | { type: "duplicate-track"; id: string }
  | { type: "edit-clip"; id: string; change: (clip: Arranged) => Arranged }
  | { type: "fade-time"; time: TimeSelection }
  | { type: "insert-time"; at: number; length: number }
  /** Puts the tracks into a new group track, where the first of them was; it goes in the group they shared, if they shared one. */
  | { type: "group-tracks"; ids: readonly string[]; name?: string }
  /** Moves a track to `index` among the tracks, with the tracks of a group: it joins the group of the track it lands before. */
  | { type: "move-track"; id: string; index: number }
  /** Dissolves a group: its tracks go into the group it was in, and its own devices and mix go with it. */
  | { type: "ungroup"; id: string }
  | { type: "paste"; clipping: Clipping; at: number; track: string }
  | { type: "redo" }
  | { type: "release-clips" }
  | { type: "remove-clip"; id: string }
  | { type: "remove-time"; from: number; to: number }
  | { type: "remove-track"; id: string }
  | { type: "rename-clip"; id: string; name: string }
  | { type: "rename-track"; id: string; name: string }
  | { type: "select-all" }
  | { type: "select-clip"; id: string; additive: boolean }
  | { type: "select-clips"; ids: string[] }
  | { type: "select-track"; id: string; additive: boolean }
  | { type: "set-duration"; duration: number }
  | { type: "set-fade-shape"; id: string; edge: "in" | "out"; shape: FadeShape }
  | { type: "settle-clip-edit" }
  | { type: "split-cursor"; at: number; step: number }
  | { type: "toggle-selected" }
  | { type: "undo" };

const NONE: readonly string[] = [];

const trackOrder = (doc: ArrangementDoc) => doc.tracks.map((track) => track.id);

/** Every track of the document: the tracks, the returns, then the main track. */
export function allTracks(doc: ArrangementDoc): ArrangementTrack[] {
  return [...doc.tracks, ...doc.returns, doc.main];
}

/** The track `id`, wherever it is: one of the tracks, a return or the main track. */
export function trackOf(
  doc: ArrangementDoc,
  id: string
): ArrangementTrack | undefined {
  return allTracks(doc).find((track) => track.id === id);
}

/** Whether `id` is a return track or the main track: they play no clips and hold no instrument. */
function isBus(doc: ArrangementDoc, id: string): boolean {
  return doc.main.id === id || doc.returns.some((track) => track.id === id);
}

/** The document with the track `id` changed, wherever it is; the same document when `change` changes nothing. */
function withTrack(
  doc: ArrangementDoc,
  id: string,
  change: (track: ArrangementTrack) => ArrangementTrack
): ArrangementDoc {
  if (doc.main.id === id) {
    return { ...doc, main: change(doc.main) };
  }
  const list = doc.returns.some((track) => track.id === id)
    ? "returns"
    : "tracks";
  return {
    ...doc,
    [list]: doc[list].map((track) => (track.id === id ? change(track) : track)),
  };
}

/** A new id for a piece of the clip `id`: the first `-n` that no clip in `taken` has. */
function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** Whether a change made nothing: the same clips and tracks, item for item. */
function sameDoc(a: ArrangementDoc, b: ArrangementDoc): boolean {
  return (
    sameItems(a.clips, b.clips) &&
    sameItems(a.tracks, b.tracks) &&
    sameItems(a.returns, b.returns) &&
    a.main === b.main &&
    sameItems(a.locators, b.locators) &&
    sameItems(a.signatures, b.signatures) &&
    a.duration === b.duration &&
    a.loop === b.loop &&
    a.tempo === b.tempo
  );
}

/** A change made in one go: one step of the history, or none when it changed nothing. */
function edit(
  state: ArrangementState,
  change: (doc: ArrangementDoc) => ArrangementDoc
): ArrangementState {
  const doc = change(state.doc);
  return sameDoc(doc, state.doc)
    ? state
    : { ...state, doc, history: recordChange(state.history, state.doc) };
}

/** The first change of a drag: the whole drag is one step, settled by a commit. */
function burst(
  state: ArrangementState,
  change: (doc: ArrangementDoc) => ArrangementDoc
): ArrangementState {
  const doc = change(state.doc);
  return sameDoc(doc, state.doc)
    ? state
    : { ...state, doc, history: beginChange(state.history, state.doc) };
}

function withSelection(
  state: ArrangementState,
  selection: ArrangementSelection | null
): ArrangementState {
  return selection === state.selection ? state : { ...state, selection };
}

function splitWhere(
  state: ArrangementState,
  targets: (clip: Arranged) => boolean,
  at: number,
  step: number
): ArrangementState {
  return edit(state, (doc) => {
    const taken = new Set(doc.clips.map((clip) => clip.id));
    return {
      ...doc,
      clips: doc.clips.flatMap((clip) => {
        const cut = targets(clip) ? splitClip(clip.value, at, step) : null;
        if (!cut) {
          return [clip];
        }
        return [
          { ...clip, value: cut[0] },
          { ...clip, id: freshId(clip.id, taken), value: cut[1] },
        ];
      }),
    };
  });
}

/** Copies each clip right after itself, and selects the copies. */
function duplicateClips(
  state: ArrangementState,
  chosen: Arranged[]
): ArrangementState {
  const { duration } = state.doc;
  const made: Arranged[] = [];
  const next = edit(state, (doc) => ({
    ...doc,
    clips: chosen.reduce((laid, clip) => {
      const copy = {
        ...clip,
        id: freshId(clip.id, new Set(laid.map((item) => item.id))),
        value: duplicateClip(clip.value, {
          duration,
          sourceLength: clip.sourceLength,
        }),
      };
      made.push(copy);
      return lay(laid, copy, duration);
    }, doc.clips),
  }));
  return withSelection(next, {
    clips: made.map((copy) => copy.id),
    tracks: [],
  });
}

function toggleClips(
  state: ArrangementState,
  id: string,
  ids: readonly string[]
): ArrangementState {
  const off = !state.doc.clips.find((clip) => clip.id === id)?.disabled;
  return edit(state, (doc) => ({
    ...doc,
    clips: doc.clips.map((clip) =>
      ids.includes(clip.id) ? { ...clip, disabled: off } : clip
    ),
  }));
}

function changeClip(
  state: ArrangementState,
  id: string,
  value: ClipValue,
  details: ClipChange
): ArrangementState {
  const selected = state.selection?.clips ?? NONE;
  const current = state.doc.clips;
  let { copying, group } = state.gesture;
  // A copy of a clip in a selection copies the whole selection.
  if (!(details.copy && copying)) {
    copying =
      details.copy && details.target === "move"
        ? current.filter((clip) =>
            selected.length > 1 && selected.includes(id)
              ? selected.includes(clip.id)
              : clip.id === id
          )
        : null;
  }
  const grouped =
    details.target === "move" &&
    details.delta !== undefined &&
    selected.length > 1 &&
    selected.includes(id);
  if (grouped && !group) {
    group = new Map(
      current
        .filter((clip) => selected.includes(clip.id))
        .map((clip) => [clip.id, clip])
    );
  }
  const origins = grouped ? group : null;
  // A fade where two clips meet is theirs together: the other clip's facing fade follows it.
  const fadeEdges = { "fade-in": "in", "fade-out": "out" } as const;
  const fading =
    details.target === "fade-in" || details.target === "fade-out"
      ? fadeEdges[details.target]
      : null;
  const next = burst(state, (doc) => {
    const clips = doc.clips.map((clip) => {
      if (clip.id === id) {
        return { ...clip, value };
      }
      const origin = origins?.get(clip.id);
      return origin && details.delta !== undefined
        ? {
            ...clip,
            value: moveClip(origin.value, origin.value.start + details.delta, {
              duration: state.doc.duration,
            }),
          }
        : clip;
    });
    return {
      ...doc,
      clips: fading ? crossfade(clips, id, fading) : clips,
    };
  });
  return { ...next, gesture: { copying, group } };
}

function commitClip(
  state: ArrangementState,
  id: string,
  copy: boolean,
  track: string | undefined
): ArrangementState {
  const { gesture } = state;
  const selected = state.selection?.clips ?? NONE;
  const settled: ArrangementState = {
    ...state,
    gesture: { copying: null, group: null },
    history: settleChange(state.history),
  };
  const { copying, group } = gesture;
  const origins = copy ? (copying ?? []) : [];
  return {
    ...settled,
    doc: {
      ...settled.doc,
      clips: land(settled.doc.clips, {
        duration: state.doc.duration,
        group: group
          ? [...group.keys()]
          : otherSelected(selected as string[], id),
        id,
        order: trackOrder(state.doc),
        origins,
        track,
      }),
    },
  };
}

function clipAction(
  state: ArrangementState,
  command: Extract<ArrangementCommand, { type: "clip-action" }>
): ArrangementState {
  const selected = state.selection?.clips ?? NONE;
  const ids = selected.includes(command.id) ? selected : [command.id];
  switch (command.action) {
    case "remove":
      return removeClip(state, command.id);
    case "duplicate":
      return duplicateClips(
        state,
        state.doc.clips.filter((clip) => ids.includes(clip.id))
      );
    case "split":
      return splitWhere(
        state,
        (clip) => ids.includes(clip.id),
        command.at,
        command.step
      );
    case "toggle":
      return toggleClips(state, command.id, ids);
    default:
      // Renaming and editing are the view's: they change nothing here.
      return state;
  }
}

function selectTrack(
  state: ArrangementState,
  id: string,
  additive: boolean
): ArrangementState {
  const picked = state.selection?.tracks ?? NONE;
  if (!additive) {
    return withSelection(
      state,
      picked.length === 1 && picked[0] === id
        ? state.selection
        : { clips: [], tracks: [id] }
    );
  }
  return withSelection(state, {
    clips: [],
    tracks: picked.includes(id)
      ? picked.filter((other) => other !== id)
      : [...picked, id],
  });
}

/** The ids every device of the document has. */
function deviceIds(doc: ArrangementDoc): Set<string> {
  return new Set(
    allTracks(doc).flatMap((track) =>
      (track.devices ?? []).flatMap((device) =>
        device.rack
          ? [device.id, ...rackDevices(device.rack).map((inside) => inside.id)]
          : [device.id]
      )
    )
  );
}

/** Every chain id of every rack, so a new chain takes one no rack has. */
function chainIds(doc: ArrangementDoc): Set<string> {
  const racks = allTracks(doc).flatMap((track) =>
    (track.devices ?? []).flatMap((device) =>
      device.rack ? [device, ...rackDevices(device.rack)] : []
    )
  );
  return new Set(
    racks.flatMap(
      (device) => device.rack?.chains.map((chain) => chain.id) ?? []
    )
  );
}

/** A chain of devices with the device `id` changed, wherever it is, down the racks within; the same chain when nothing changed. */
function mapDevice(
  devices: readonly TrackDevice[],
  id: string,
  change: (device: TrackDevice) => TrackDevice
): readonly TrackDevice[] {
  const next = devices.map((device) => {
    if (device.id === id) {
      return change(device);
    }
    if (!device.rack) {
      return device;
    }
    const chains = device.rack.chains.map((chain) => {
      const inside = mapDevice(chain.devices, id, change);
      return inside === chain.devices ? chain : { ...chain, devices: inside };
    });
    return sameItems(chains, device.rack.chains)
      ? device
      : { ...device, rack: { ...device.rack, chains } };
  });
  return sameItems(next, devices) ? devices : next;
}

/** A chain of devices without the device `id`, wherever it is; the same chain when it was not there. */
function dropDevice(
  devices: readonly TrackDevice[],
  id: string
): readonly TrackDevice[] {
  let changed = false;
  const kept: TrackDevice[] = [];
  for (const device of devices) {
    if (device.id === id) {
      changed = true;
    } else if (device.rack) {
      const chains = device.rack.chains.map((chain) => {
        const inside = dropDevice(chain.devices, id);
        return inside === chain.devices ? chain : { ...chain, devices: inside };
      });
      const same = sameItems(chains, device.rack.chains);
      changed ||= !same;
      kept.push(
        same ? device : { ...device, rack: { ...device.rack, chains } }
      );
    } else {
      kept.push(device);
    }
  }
  return changed ? kept : devices;
}

/** A rack of a track changed, wherever it is on the track's chain, as one step or a burst. */
function changeRack(
  state: ArrangementState,
  track: string,
  rack: string,
  change: (rack: Rack) => Rack,
  write: typeof edit
): ArrangementState {
  return changeDevice(
    state,
    track,
    rack,
    (device) =>
      device.rack ? { ...device, rack: change(device.rack) } : device,
    write
  );
}

/** A rack with the chain `id` changed. */
const withChain = (
  rack: Rack,
  id: string,
  change: (chain: RackChain) => RackChain
): Rack => ({
  ...rack,
  chains: rack.chains.map((chain) => (chain.id === id ? change(chain) : chain)),
});

/** A rack with its macro `index` changed. */
const withMacro = (
  rack: Rack,
  index: number,
  change: (macro: RackMacro) => RackMacro
): Rack => ({
  ...rack,
  macros: rack.macros.map((macro, at) =>
    at === index ? change(macro) : macro
  ),
});

/** The effects of a track's chain put into a new rack, one chain of them, where the first of them was. */
function groupDevices(
  state: ArrangementState,
  track: string,
  ids: readonly string[]
): ArrangementState {
  const chain = trackOf(state.doc, track)?.devices ?? [];
  const grouped = chain.filter(
    (device) => ids.includes(device.id) && !device.instrument
  );
  if (grouped.length === 0) {
    return state;
  }
  const rack: TrackDevice = {
    device: RACK_DEVICE,
    id: freshId("rack", deviceIds(state.doc)),
    rack: newRack(freshId("chain", chainIds(state.doc)), grouped),
    state: {},
  };
  const first = chain.indexOf(grouped[0] as TrackDevice);
  const rest = chain.filter((device) => !grouped.includes(device));
  const at = rest.filter((device) => chain.indexOf(device) < first).length;
  return edit(state, (doc) =>
    withTrack(doc, track, (item) => ({
      ...item,
      devices: [...rest.slice(0, at), rack, ...rest.slice(at)],
    }))
  );
}

/**
 * A chain with `device` at `index`, or at its end: an instrument goes first,
 * in place of the one there was, and no effect goes before it.
 */
function placeDevice(
  chain: readonly TrackDevice[],
  device: TrackDevice,
  index?: number
): TrackDevice[] {
  const others = chain.filter(
    (item) => item.id !== device.id && !(device.instrument && item.instrument)
  );
  if (device.instrument) {
    return [device, ...others];
  }
  const first = others[0]?.instrument ? 1 : 0;
  const at = Math.min(others.length, Math.max(first, index ?? others.length));
  return [...others.slice(0, at), device, ...others.slice(at)];
}

/** Whether the track `id` can hold an instrument: a MIDI track. */
function holdsInstrument(doc: ArrangementDoc, id: string): boolean {
  return !isBus(doc, id) && trackOf(doc, id)?.kind === "midi";
}

/** What a new rack holds: one empty chain, or a drum rack's starting kit. */
function rackFor(doc: ArrangementDoc, device: string): { rack?: Rack } {
  const taken = chainIds(doc);
  if (device === RACK_DEVICE || device === INSTRUMENT_RACK_DEVICE) {
    return { rack: newRack(freshId("chain", taken)) };
  }
  if (device === DRUM_RACK_DEVICE) {
    return {
      rack: newDrumRack([
        freshId("chain", taken),
        freshId("chain", taken),
        freshId("chain", taken),
      ]),
    };
  }
  return {};
}

/** The sound of `note`'s pad put on: on the chain that answers it, or on a new one. */
function setPad(
  rack: Rack,
  note: number,
  sound: DrumSound,
  id: string,
  name = "Pad"
): Rack {
  const at = Math.round(Math.min(127, Math.max(0, note)));
  const there = rack.chains.find((chain) => chain.pad?.note === at);
  if (there) {
    return withChain(rack, there.id, (chain) => ({
      ...chain,
      name: name.trim() || chain.name,
      pad: { note: at, sound },
    }));
  }
  return {
    ...rack,
    chains: [
      ...rack.chains,
      { devices: [], id, name: name.trim() || "Pad", pad: { note: at, sound } },
    ],
  };
}

/** A range kept within `low` and `high`, its ends in order. */
const within = (
  [from, to]: readonly [number, number],
  low: number,
  high: number
): [number, number] => {
  const clamp = (value: number) => Math.min(high, Math.max(low, value));
  return [clamp(Math.min(from, to)), clamp(Math.max(from, to))];
};

/** A chain's zone with `patch` over it: its keys whole notes from 0 to 127, its velocities from 0 to 1. */
function zoned(
  zone: ChainZone | undefined,
  patch: Partial<ChainZone>
): ChainZone {
  const next = { ...FULL_ZONE, ...zone, ...patch };
  const [low, high] = within(next.keys, 0, 127);
  return {
    keys: [Math.round(low), Math.round(high)],
    velocity: within(next.velocity, 0, 1),
  };
}

/** A pad moved to `note`, and the pad there, if any, to the note the first had. */
function movePad(rack: Rack, id: string, note: number): Rack {
  const moved = rack.chains.find((chain) => chain.id === id)?.pad;
  const to = Math.round(Math.min(127, Math.max(0, note)));
  if (!moved || moved.note === to) {
    return rack;
  }
  return {
    ...rack,
    chains: rack.chains.map((chain) => {
      if (chain.id === id) {
        return { ...chain, pad: { ...moved, note: to } };
      }
      return chain.pad?.note === to
        ? { ...chain, pad: { ...chain.pad, note: moved.note } }
        : chain;
    }),
  };
}

/**
 * Whether the rack `rack` on `track` takes the instrument `device` at the head
 * of a chain: an instrument rack does, for an instrument of the library, not
 * a rack.
 */
function takesInstrument(
  doc: ArrangementDoc,
  track: string,
  rack: string,
  device: TrackDevice
): boolean {
  const devices = trackOf(doc, track)?.devices ?? [];
  const target = [
    ...devices,
    ...devices.flatMap((item) => (item.rack ? rackDevices(item.rack) : [])),
  ].find((item) => item.id === rack);
  return target?.device === INSTRUMENT_RACK_DEVICE && !device.rack;
}

function addDevice(
  state: ArrangementState,
  command: Extract<ArrangementCommand, { type: "add-device" }>
): ArrangementState {
  const { device, index, instrument, state: values, track } = command;
  if (
    !trackOf(state.doc, track) ||
    (instrument && !holdsInstrument(state.doc, track))
  ) {
    return state;
  }
  const added: TrackDevice = {
    device,
    id: freshId("device", deviceIds(state.doc)),
    ...(instrument ? { instrument: true } : {}),
    ...rackFor(state.doc, device),
    state: values,
  };
  const { chain } = command;
  if (chain) {
    return instrument && !takesInstrument(state.doc, track, chain.rack, added)
      ? state
      : changeRack(
          state,
          track,
          chain.rack,
          (rack) =>
            withChain(rack, chain.chain, (item) => ({
              ...item,
              devices: placeDevice(item.devices, added, index),
            })),
          edit
        );
  }
  return edit(state, (doc) =>
    withTrack(doc, track, (item) => ({
      ...item,
      devices: placeDevice(item.devices ?? [], added, index),
    }))
  );
}

function moveDevice(
  state: ArrangementState,
  {
    chain: along,
    id,
    index,
    to,
    track,
  }: Extract<ArrangementCommand, { type: "move-device" }>
): ArrangementState {
  if (along) {
    return changeRack(
      state,
      track,
      along.rack,
      (rack) =>
        withChain(rack, along.chain, (item) => {
          const device = item.devices.find((each) => each.id === id);
          const placed = device
            ? placeDevice(item.devices, device, index)
            : item.devices;
          return sameItems(placed, item.devices)
            ? item
            : { ...item, devices: placed };
        }),
      edit
    );
  }
  const target = to ?? track;
  const device = trackOf(state.doc, track)?.devices?.find(
    (item) => item.id === id
  );
  if (
    !(device && trackOf(state.doc, target)) ||
    (device.instrument && !holdsInstrument(state.doc, target))
  ) {
    return state;
  }
  const chain = trackOf(state.doc, target)?.devices ?? [];
  const placed = placeDevice(chain, device, index);
  if (sameItems(placed, chain)) {
    return state;
  }
  return edit(state, (doc) => {
    const left =
      target === track
        ? doc
        : withTrack(doc, track, (item) => ({
            ...item,
            devices: (item.devices ?? []).filter((other) => other.id !== id),
          }));
    return withTrack(left, target, (item) => ({ ...item, devices: placed }));
  });
}

/** The track's device `id` changed by `change`, as one step (`edit`) or a burst. */
function changeDevice(
  state: ArrangementState,
  track: string,
  id: string,
  change: (device: TrackDevice) => TrackDevice,
  write: typeof edit
): ArrangementState {
  return write(state, (doc) =>
    withTrack(doc, track, (item) => {
      const devices = mapDevice(item.devices ?? [], id, change);
      return devices === (item.devices ?? []) ? item : { ...item, devices };
    })
  );
}

/** How much `track` sends to the return `to`, as one step or a burst. */
function setSend(
  state: ArrangementState,
  track: string,
  to: string,
  level: number,
  write: typeof edit
): ArrangementState {
  const gain = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  if (
    track === to ||
    !state.doc.returns.some((item) => item.id === to) ||
    (trackOf(state.doc, track)?.sends?.[to] ?? 0) === gain
  ) {
    return state;
  }
  return write(state, (doc) =>
    withTrack(doc, track, (item) => ({
      ...item,
      sends: { ...item.sends, [to]: gain },
    }))
  );
}

/** A new return track, named by its letter, after the others or after `afterId`. */
function addReturn(
  state: ArrangementState,
  afterId: string | undefined
): ArrangementState {
  const { returns } = state.doc;
  const letter = String.fromCharCode(65 + (returns.length % 26));
  const track: ArrangementTrack = {
    color: returns.length % state.colors,
    id: freshId("return", new Set(returns.map((item) => item.id))),
    name: `${letter} Return`,
  };
  return edit(state, (doc) => {
    const at = afterId
      ? doc.returns.findIndex((item) => item.id === afterId) + 1
      : doc.returns.length;
    const next = [...doc.returns];
    next.splice(at || doc.returns.length, 0, track);
    return { ...doc, returns: next };
  });
}

/** What one kind of command does to the state: its handler, given the command with its own fields. */
type Handlers = {
  [K in ArrangementCommand["type"]]: (
    state: ArrangementState,
    command: Extract<ArrangementCommand, { type: K }>
  ) => ArrangementState;
};

/** A track again right after it, with copies of its clips; a group, with every track in it. */
/** A track's automation with its devices' envelopes under the new ids `renamed` gives them. */
function renamedAutomation(
  automation: TrackAutomation | undefined,
  renamed: ReadonlyMap<string, string>
): { automation?: TrackAutomation } {
  if (!automation) {
    return {};
  }
  return {
    automation: Object.fromEntries(
      Object.entries(automation).map(([key, points]) => {
        const named = parseDeviceParameter(key);
        const device = named && renamed.get(named.device);
        return [
          device && named ? deviceParameterKey(device, named.parameter) : key,
          points,
        ];
      })
    ) as TrackAutomation,
  };
}

function duplicateTrack(state: ArrangementState, id: string): ArrangementState {
  const { tracks } = state.doc;
  if (!tracks.some((item) => item.id === id)) {
    return state;
  }
  const block = trackBlock(tracks, id);
  const sources = tracks.filter((item) => block.includes(item.id));
  const devicesTaken = deviceIds(state.doc);
  // Each track of the block takes the next number, and the copies keep their groups among themselves.
  const ids = new Map(
    sources.map((item, index) => [
      item.id,
      `track-${state.trackCount + index + 1}`,
    ])
  );
  const copies = sources.map((item): ArrangementTrack => {
    const group = item.group === undefined ? undefined : ids.get(item.group);
    const renamed = new Map(
      (item.devices ?? []).map((device) => [
        device.id,
        freshId("device", devicesTaken),
      ])
    );
    return {
      ...item,
      devices: item.devices?.map((device) => ({
        ...device,
        id: renamed.get(device.id) ?? device.id,
      })),
      ...renamedAutomation(item.automation, renamed),
      ...(group === undefined ? {} : { group }),
      id: ids.get(item.id) ?? item.id,
      name: item.id === id ? `${item.name} copy` : item.name,
    };
  });
  const next = edit(state, (doc) => {
    const last = Math.max(
      ...block.map((each) => doc.tracks.findIndex((item) => item.id === each))
    );
    const list = [...doc.tracks];
    list.splice(last + 1, 0, ...copies);
    const taken = new Set(doc.clips.map((clip) => clip.id));
    const clips = doc.clips
      .filter((clip) => ids.has(clip.track))
      .map((clip) => ({
        ...clip,
        id: freshId(clip.id, taken),
        track: ids.get(clip.track) ?? clip.track,
      }));
    return { ...doc, clips: [...doc.clips, ...clips], tracks: list };
  });
  return { ...next, trackCount: state.trackCount + sources.length };
}

/** A track and every track in it, down the groups within: a group's block, which stays together in the list. */
export function trackBlock(
  tracks: readonly ArrangementTrack[],
  id: string
): string[] {
  const block = [id];
  for (const track of tracks) {
    if (
      track.group !== undefined &&
      block.includes(track.group) &&
      !block.includes(track.id)
    ) {
      block.push(track.id);
    }
  }
  return block;
}

/** The tracks shown: those inside a folded group are hidden, its own row stays. */
export function unfoldedTracks(
  tracks: readonly ArrangementTrack[],
  folded: Readonly<Record<string, boolean>>
): ArrangementTrack[] {
  const hidden = new Set(
    tracks
      .filter((track) => track.kind === "group" && folded[track.id])
      .flatMap((track) => trackBlock(tracks, track.id).slice(1))
  );
  return tracks.filter((track) => !hidden.has(track.id));
}

/** How deep a track sits: 0 at the top, 1 in a group, 2 in a group within one. */
export function trackDepth(
  tracks: readonly ArrangementTrack[],
  id: string
): number {
  const groupOf = new Map(tracks.map((track) => [track.id, track.group]));
  let depth = 0;
  let at = groupOf.get(id);
  while (at !== undefined && depth < tracks.length) {
    depth += 1;
    at = groupOf.get(at);
  }
  return depth;
}

/** The track as it stands in `group`, or at the top with none. */
const inGroup = (
  track: ArrangementTrack,
  group: string | undefined
): ArrangementTrack => {
  if (track.group === group) {
    return track;
  }
  const { group: _left, ...rest } = track;
  return group === undefined ? rest : { ...rest, group };
};

function moveTrack(
  state: ArrangementState,
  id: string,
  index: number
): ArrangementState {
  return edit(state, (doc) => {
    if (doc.returns.some((item) => item.id === id)) {
      const from = doc.returns.findIndex((item) => item.id === id);
      if (from === index) {
        return doc;
      }
      const moved = [...doc.returns];
      const [track] = moved.splice(from, 1);
      moved.splice(
        Math.min(Math.max(index, 0), moved.length),
        0,
        track as ArrangementTrack
      );
      return { ...doc, returns: moved };
    }
    const from = doc.tracks.findIndex((item) => item.id === id);
    if (from === -1) {
      return doc;
    }
    const block = trackBlock(doc.tracks, id);
    const rest = doc.tracks.filter((track) => !block.includes(track.id));
    const at = Math.min(Math.max(index, 0), rest.length);
    // It joins the group of the track it lands before: between a group and its tracks, the group.
    const next = rest[at];
    const group = next?.group;
    const moved = doc.tracks
      .filter((track) => block.includes(track.id))
      .map((track) => (track.id === id ? inGroup(track, group) : track));
    const tracks = [...rest.slice(0, at), ...moved, ...rest.slice(at)];
    const same = tracks.every((track, place) => track === doc.tracks[place]);
    return same ? doc : { ...doc, tracks };
  });
}

/** The tracks picked, put into a new group where the first of them was. */
function groupTracks(
  state: ArrangementState,
  ids: readonly string[],
  name: string | undefined
): ArrangementState {
  const { tracks } = state.doc;
  // A track in a group that is grouped too goes along with it.
  const tops = tracks.filter(
    (track) =>
      ids.includes(track.id) &&
      !ids.some(
        (other) =>
          other !== track.id && trackBlock(tracks, other).includes(track.id)
      )
  );
  if (tops.length === 0) {
    return state;
  }
  const parents = new Set(tops.map((track) => track.group));
  const parent = parents.size === 1 ? tops[0]?.group : undefined;
  const id = freshId("group", new Set(tracks.map((track) => track.id)));
  const count = state.trackCount + 1;
  const group: ArrangementTrack = {
    color: (count - 1) % state.colors,
    id,
    kind: "group",
    name:
      name?.trim() ||
      `Group ${tracks.filter((track) => track.kind === "group").length + 1}`,
    ...(parent === undefined ? {} : { group: parent }),
  };
  const moving = new Set(tops.flatMap((track) => trackBlock(tracks, track.id)));
  const first = tracks.findIndex((track) => moving.has(track.id));
  const before = tracks
    .slice(0, first)
    .filter((track) => !moving.has(track.id));
  const after = tracks.slice(first).filter((track) => !moving.has(track.id));
  const inside = tracks
    .filter((track) => moving.has(track.id))
    .map((track) => (tops.includes(track) ? inGroup(track, id) : track));
  const next = edit(state, (doc) => ({
    ...doc,
    tracks: [...before, group, ...inside, ...after],
  }));
  return { ...next, trackCount: count };
}

/** A group dissolved: its tracks go up into the group it was in. */
function ungroup(state: ArrangementState, id: string): ArrangementState {
  const group = state.doc.tracks.find((track) => track.id === id);
  if (group?.kind !== "group") {
    return state;
  }
  return edit(state, (doc) => ({
    ...doc,
    tracks: doc.tracks
      .filter((track) => track.id !== id)
      .map((track) =>
        track.group === id ? inGroup(track, group.group) : track
      ),
  }));
}

function changeTrack(
  state: ArrangementState,
  id: string,
  change: (track: ArrangementTrack) => ArrangementTrack,
  write: typeof edit
): ArrangementState {
  return write(state, (doc) => withTrack(doc, id, change));
}

/** Whether `patch` says nothing the mix does not already say. */
function sameMix(mix: Mix, patch: Partial<Mix>): boolean {
  return (Object.keys(patch) as (keyof Mix)[]).every(
    (key) => mix[key] === patch[key]
  );
}

function setMix(
  state: ArrangementState,
  id: string,
  patch: Partial<Omit<Mix, "color">>,
  write: typeof edit
): ArrangementState {
  const track = trackOf(state.doc, id);
  if (!track || sameMix(mixOf(track), patch)) {
    return state;
  }
  return changeTrack(
    state,
    id,
    (item) => {
      const { color: _color, ...mix } = mixOf(item);
      return { ...item, mix: { ...mix, ...patch } as Mix };
    },
    write
  );
}

function renameTrack(
  state: ArrangementState,
  id: string,
  name: string
): ArrangementState {
  const next = name.trim();
  if (!next || next === trackOf(state.doc, id)?.name) {
    return state;
  }
  return edit(state, (doc) =>
    withTrack(doc, id, (item) => ({ ...item, name: next }))
  );
}

function renameClip(
  state: ArrangementState,
  id: string,
  name: string
): ArrangementState {
  const next = name.trim();
  if (!next || next === state.doc.clips.find((clip) => clip.id === id)?.name) {
    return state;
  }
  return edit(state, (doc) => ({
    ...doc,
    clips: doc.clips.map((clip) =>
      clip.id === id ? { ...clip, name: next } : clip
    ),
  }));
}

function removeTrack(state: ArrangementState, id: string): ArrangementState {
  if (state.doc.main.id === id) {
    return state;
  }
  if (state.doc.returns.some((track) => track.id === id)) {
    const unsend = (track: ArrangementTrack): ArrangementTrack => {
      if (!(track.sends && id in track.sends)) {
        return track;
      }
      const { [id]: _gone, ...sends } = track.sends;
      return { ...track, sends };
    };
    return edit(state, (doc) => ({
      ...doc,
      main: unsend(doc.main),
      returns: doc.returns.filter((track) => track.id !== id).map(unsend),
      tracks: doc.tracks.map(unsend),
    }));
  }
  // A track among the tracks picked takes the others with it, and a group the tracks in it.
  const picked = state.selection?.tracks ?? NONE;
  const gone = (picked.includes(id) ? picked : [id]).flatMap((each) =>
    trackBlock(state.doc.tracks, each)
  );
  return withSelection(
    edit(state, (doc) => ({
      ...doc,
      clips: doc.clips.filter((clip) => !gone.includes(clip.track)),
      tracks: doc.tracks.filter((track) => !gone.includes(track.id)),
    })),
    null
  );
}

function removeClip(state: ArrangementState, id: string): ArrangementState {
  const selected = state.selection?.clips ?? NONE;
  const gone = selected.includes(id) ? selected : [id];
  return withSelection(
    edit(state, (doc) => ({
      ...doc,
      clips: doc.clips.filter((clip) => !gone.includes(clip.id)),
    })),
    null
  );
}

function changeAutomation(
  state: ArrangementState,
  trackId: string,
  parameter: AutomatedParameter,
  points: readonly Breakpoint[] | null
): ArrangementState {
  return burst(state, (doc) => ({
    ...doc,
    tracks: doc.tracks.map((track) => {
      if (track.id !== trackId) {
        return track;
      }
      const { [parameter]: _cleared, ...kept } = track.automation ?? {};
      return {
        ...track,
        automation: points ? { ...kept, [parameter]: points } : kept,
      };
    }),
  }));
}

const sameTempo = (a: Tempo, b: Tempo) =>
  a.bpm === b.bpm &&
  a.beatsPerBar === b.beatsPerBar &&
  a.beatUnit === b.beatUnit;

const sameSpan = (a: Span, b: Span) => a[0] === b[0] && a[1] === b[1];

/**
 * A tempo change keeps the musical positions: every time in the document is
 * scaled to the new bar, so a clip three bars long stays three bars long. It
 * is one step of the history, and the steps before it keep their own tempo.
 */
function setTempo(state: ArrangementState, tempo: Tempo): ArrangementState {
  const ratio = secondsPerBar(tempo) / secondsPerBar(state.doc.tempo);
  // A tempo that cannot be one has no bar to scale to: leave the document as it is.
  if (
    sameTempo(tempo, state.doc.tempo) ||
    !Number.isFinite(ratio) ||
    ratio <= 0
  ) {
    return state;
  }
  const scaled = <T extends { at: number }>(item: T): T => ({
    ...item,
    at: item.at * ratio,
  });
  return edit(state, (doc) => ({
    ...doc,
    clips: settleOverlaps(
      doc.clips.map((clip) => scaleClip(clip, ratio)),
      doc.duration * ratio
    ),
    duration: doc.duration * ratio,
    locators: doc.locators.map(scaled),
    loop: {
      ...doc.loop,
      range: [doc.loop.range[0] * ratio, doc.loop.range[1] * ratio],
    },
    signatures: doc.signatures.map(scaled),
    tempo,
  }));
}

/** A signature change at `at`, in the signature in force there, and the next free id. */
function addSignature(state: ArrangementState, at: number): ArrangementState {
  const { signatures, tempo } = state.doc;
  const [held] = signatures
    .filter((change) => change.at <= at)
    .sort((a, b) => b.at - a.at);
  const id = freshId(
    "signature",
    new Set(signatures.map((change) => change.id))
  );
  return edit(state, (doc) => ({
    ...doc,
    signatures: [
      ...doc.signatures.filter((change) => change.at !== at),
      {
        at,
        beatUnit: held?.beatUnit ?? tempo.beatUnit,
        beatsPerBar: held?.beatsPerBar ?? tempo.beatsPerBar,
        id,
      },
    ],
  }));
}

function changeSignature(
  state: ArrangementState,
  id: string,
  change: (signature: ArrangementSignature) => ArrangementSignature
): ArrangementState {
  return edit(state, (doc) => ({
    ...doc,
    signatures: doc.signatures.map((item) =>
      item.id === id ? change(item) : item
    ),
  }));
}

function changeLocator<Key extends "at" | "name">(
  state: ArrangementState,
  id: string,
  key: Key,
  value: ArrangementLocator[Key]
): ArrangementState {
  return edit(state, (doc) => ({
    ...doc,
    locators: doc.locators.map((locator) =>
      locator.id === id && locator[key] !== value
        ? { ...locator, [key]: value }
        : locator
    ),
  }));
}

function setLoop(
  state: ArrangementState,
  change: Partial<ArrangementLoop>
): ArrangementState {
  const { on, range } = state.doc.loop;
  if ((change.on ?? on) === on && sameSpan(change.range ?? range, range)) {
    return state;
  }
  return edit(state, (doc) => ({
    ...doc,
    loop: { on: change.on ?? on, range: change.range ?? range },
  }));
}

/** A drag of the loop's range: the first tick opens a step, `settle-clip-edit` closes it. */
function changeLoop(state: ArrangementState, range: Span): ArrangementState {
  if (sameSpan(range, state.doc.loop.range)) {
    return state;
  }
  return burst(state, (doc) => ({ ...doc, loop: { ...doc.loop, range } }));
}

function selectClip(
  state: ArrangementState,
  id: string,
  additive: boolean
): ArrangementState {
  const selected = state.selection?.clips ?? NONE;
  if (additive) {
    return withSelection(state, {
      clips: selected.includes(id)
        ? selected.filter((other) => other !== id)
        : [...selected, id],
      tracks: [],
    });
  }
  return withSelection(
    state,
    selected.includes(id) ? state.selection : { clips: [id], tracks: [] }
  );
}

function selectAll(state: ArrangementState): ArrangementState {
  return withSelection(state, {
    clips: state.doc.clips.map((clip) => clip.id),
    tracks: [],
  });
}

function releaseClips(state: ArrangementState): ArrangementState {
  return withSelection(
    state,
    state.selection?.tracks.length ? state.selection : null
  );
}

function splitAtCursor(
  state: ArrangementState,
  at: number,
  step: number
): ArrangementState {
  const selected = state.selection?.clips ?? NONE;
  const tracks = state.selection?.tracks ?? NONE;
  return splitWhere(
    state,
    (clip) => selected.includes(clip.id) || tracks.includes(clip.track),
    at,
    step
  );
}

function fadeShape(
  state: ArrangementState,
  id: string,
  edge: "in" | "out",
  shape: FadeShape
): ArrangementState {
  return edit(state, (doc) => ({
    ...doc,
    clips: doc.clips.map((clip) =>
      clip.id === id
        ? { ...clip, value: setClipFadeShape(clip.value, edge, shape) }
        : clip
    ),
  }));
}

function cropOne(state: ArrangementState, id: string): ArrangementState {
  return edit(state, (doc) => ({
    ...doc,
    clips: doc.clips.map((clip) => (clip.id === id ? cropClip(clip) : clip)),
  }));
}

function consolidateTime(
  state: ArrangementState,
  time: TimeSelection
): ArrangementState {
  const { clips, ids } = consolidate(state.doc.clips, time, state.doc.duration);
  return withSelection(
    edit(state, (doc) => ({ ...doc, clips })),
    {
      clips: ids,
      tracks: [],
    }
  );
}

function paste(
  state: ArrangementState,
  clipping: Clipping,
  at: number,
  track: string
): ArrangementState {
  const { clips, ids } = pasteTime(
    state.doc.clips,
    clipping,
    at,
    track,
    trackOrder(state.doc),
    state.doc.duration
  );
  return withSelection(
    edit(state, (doc) => ({ ...doc, clips })),
    {
      clips: ids,
      tracks: [],
    }
  );
}

/** Takes back a step of the history, or the state when there is none. */
function restore(
  state: ArrangementState,
  step: HistoryStep<ArrangementDoc> | null
): ArrangementState {
  return step
    ? { ...state, doc: step.present, history: step.history, selection: null }
    : state;
}

const handlers: Handlers = {
  batch: (state, { commands }) => {
    const done = commands.reduce(apply, state);
    // The steps the commands recorded become one, from the document before them.
    return done.doc === state.doc
      ? done
      : { ...done, history: recordChange(state.history, state.doc) };
  },
  "add-clip": (state, { clip }) =>
    withSelection(
      edit(state, (doc) => ({
        ...doc,
        clips: lay(doc.clips, clip, state.doc.duration),
      })),
      { clips: [clip.id], tracks: [] }
    ),
  "add-locator": (state, { at }) =>
    edit(state, (doc) =>
      doc.locators.some((locator) => locator.at === at)
        ? doc
        : {
            ...doc,
            locators: [
              ...doc.locators,
              {
                at,
                id: freshId(
                  "locator",
                  new Set(doc.locators.map((locator) => locator.id))
                ),
                name: `Locator ${doc.locators.length + 1}`,
              },
            ],
          }
    ),
  "add-signature": (state, { at }) => addSignature(state, at),
  "add-device": (state, command) => addDevice(state, command),
  "add-track": (state, { afterId, id, kind = "audio", name }) => {
    if (kind === "return") {
      return addReturn(state, afterId);
    }
    const count = state.trackCount + 1;
    const free = id !== undefined && !trackOf(state.doc, id);
    const track: ArrangementTrack = {
      color: (count - 1) % state.colors,
      id: free ? id : `track-${count}`,
      kind,
      name: name?.trim() || `${TRACK_NAMES[kind]} ${count}`,
    };
    const next = edit(state, (doc) => {
      // After a track and, a group, after the tracks in it, in the group it is in.
      const after = afterId ? trackOf(doc, afterId) : undefined;
      const block = afterId ? trackBlock(doc.tracks, afterId) : [];
      const at = after
        ? Math.max(
            ...block.map((each) =>
              doc.tracks.findIndex((item) => item.id === each)
            )
          ) + 1
        : doc.tracks.length;
      const tracks = [...doc.tracks];
      tracks.splice(at || doc.tracks.length, 0, inGroup(track, after?.group));
      return { ...doc, tracks };
    });
    return { ...next, trackCount: count };
  },
  "change-automation": (state, { trackId, parameter, points }) =>
    changeAutomation(state, trackId, parameter, points),
  "change-clip": (state, { id, value, details }) =>
    changeClip(state, id, value, details),
  "change-loop": (state, { range }) => changeLoop(state, range),
  "change-device": (state, { id, state: values, track }) =>
    changeDevice(
      state,
      track,
      id,
      (device) => ({ ...device, state: values }),
      burst
    ),
  "change-mix": (state, { id, patch }) => setMix(state, id, patch, burst),
  "change-send": (state, { level, to, track }) =>
    setSend(state, track, to, level, burst),
  "move-device": (state, command) => moveDevice(state, command),
  "remove-device": (state, { id, track }) =>
    edit(state, (doc) =>
      withTrack(doc, track, (item) => {
        const devices = dropDevice(item.devices ?? [], id);
        if (devices === (item.devices ?? [])) {
          return item;
        }
        // The envelopes of what went go with it: the device and the devices of its racks.
        const kept = new Set(
          devices.flatMap((device) =>
            device.rack
              ? [
                  device.id,
                  ...rackDevices(device.rack).map((inside) => inside.id),
                ]
              : [device.id]
          )
        );
        const gone = new Set(
          (item.devices ?? [])
            .flatMap((device) =>
              device.rack
                ? [
                    device.id,
                    ...rackDevices(device.rack).map((inside) => inside.id),
                  ]
                : [device.id]
            )
            .filter((each) => !kept.has(each))
        );
        const automation = withoutDeviceAutomation(item.automation, gone);
        return {
          ...item,
          devices,
          ...(automation === item.automation ? {} : { automation }),
        };
      })
    ),
  "group-devices": (state, { ids, track }) => groupDevices(state, track, ids),
  "add-rack-chain": (state, { rack, track }) => {
    const id = freshId("chain", chainIds(state.doc));
    return changeRack(
      state,
      track,
      rack,
      (current) => ({
        ...current,
        chains: [
          ...current.chains,
          { devices: [], id, name: `Chain ${current.chains.length + 1}` },
        ],
      }),
      edit
    );
  },
  "remove-rack-chain": (state, { chain, rack, track }) =>
    changeRack(
      state,
      track,
      rack,
      (current) => ({
        ...current,
        chains: current.chains.filter((item) => item.id !== chain),
      }),
      edit
    ),
  "change-rack-chain": (state, { chain, mix, name, rack, track, zone }) =>
    changeRack(
      state,
      track,
      rack,
      (current) =>
        withChain(current, chain, (item) => ({
          ...item,
          ...(name?.trim() ? { name: name.trim() } : {}),
          ...(zone ? { zone: zoned(item.zone, zone) } : {}),
          ...(mix
            ? {
                mix: {
                  gain: 1,
                  muted: false,
                  pan: 0,
                  soloed: false,
                  ...item.mix,
                  ...mix,
                },
              }
            : {}),
        })),
      burst
    ),
  "set-macro": (state, { index, rack, track, value }) =>
    changeRack(
      state,
      track,
      rack,
      (current) =>
        withMacro(current, index, (macro) => ({
          ...macro,
          value: Math.min(1, Math.max(0, value)),
        })),
      burst
    ),
  "set-pad": (state, { name, note, rack, sound, track }) =>
    changeRack(
      state,
      track,
      rack,
      (current) =>
        setPad(
          current,
          note,
          sound,
          freshId("chain", chainIds(state.doc)),
          name
        ),
      edit
    ),
  "change-pad": (state, { chain, decay, rack, track, tune }) =>
    changeRack(
      state,
      track,
      rack,
      (current) =>
        withChain(current, chain, (item) =>
          item.pad
            ? {
                ...item,
                pad: {
                  ...item.pad,
                  sound: {
                    ...item.pad.sound,
                    ...(tune === undefined
                      ? {}
                      : { tune: Math.min(48, Math.max(-48, tune)) }),
                    ...(decay === undefined
                      ? {}
                      : { decay: Math.min(10, Math.max(0.01, decay)) }),
                  },
                },
              }
            : item
        ),
      burst
    ),
  "move-pad": (state, { chain, note, rack, track }) =>
    changeRack(
      state,
      track,
      rack,
      (current) => movePad(current, chain, note),
      edit
    ),
  "map-macro": (state, { index, mapping, rack, track }) =>
    changeRack(
      state,
      track,
      rack,
      (current) =>
        withMacro(current, index, (macro) => ({
          ...macro,
          mappings: [
            ...macro.mappings.filter(
              (item) =>
                !(
                  item.device === mapping.device &&
                  item.parameter === mapping.parameter
                )
            ),
            mapping,
          ],
        })),
      edit
    ),
  "unmap-macro": (state, { device, index, parameter, rack, track }) =>
    changeRack(
      state,
      track,
      rack,
      (current) =>
        withMacro(current, index, (macro) => ({
          ...macro,
          mappings: macro.mappings.filter(
            (item) => !(item.device === device && item.parameter === parameter)
          ),
        })),
      edit
    ),
  "set-device": (state, { id, state: values, track }) =>
    changeDevice(
      state,
      track,
      id,
      (device) => ({ ...device, state: values }),
      edit
    ),
  "set-send": (state, { level, to, track }) =>
    setSend(state, track, to, level, edit),
  "set-send-mode": (state, { id, pre }) =>
    state.doc.returns.some((item) => item.id === id) &&
    Boolean(trackOf(state.doc, id)?.pre) !== pre
      ? changeTrack(state, id, (track) => ({ ...track, pre }), edit)
      : state,
  "toggle-device": (state, { id, track }) =>
    changeDevice(
      state,
      track,
      id,
      ({ on, ...device }) => (on === false ? device : { ...device, on: false }),
      edit
    ),
  "move-locator": (state, { id, to }) =>
    changeLocator(
      state,
      id,
      "at",
      Math.min(state.doc.duration, Math.max(0, to))
    ),
  "move-signature": (state, { id, to }) =>
    changeSignature(state, id, (change) => ({
      ...change,
      at: Math.min(state.doc.duration, Math.max(0, to)),
    })),
  "remove-locator": (state, { id }) =>
    edit(state, (doc) => ({
      ...doc,
      locators: doc.locators.filter((locator) => locator.id !== id),
    })),
  "remove-signature": (state, { id }) =>
    edit(state, (doc) => ({
      ...doc,
      signatures: doc.signatures.filter((change) => change.id !== id),
    })),
  "rename-locator": (state, { id, name }) =>
    changeLocator(state, id, "name", name),
  "set-loop": (state, { loop }) => setLoop(state, loop),
  "set-mix": (state, { id, patch }) => setMix(state, id, patch, edit),
  "set-track-color": (state, { id, color }) =>
    trackOf(state.doc, id)?.color === color
      ? state
      : changeTrack(state, id, (track) => ({ ...track, color }), edit),
  "set-signature": (state, { id, beatsPerBar, beatUnit }) =>
    changeSignature(state, id, (change) => ({
      ...change,
      beatUnit,
      beatsPerBar,
    })),
  "set-tempo": (state, { tempo }) => setTempo(state, tempo),
  "clip-action": (state, command) => clipAction(state, command),
  "commit-clip": (state, { id, copy, track }) =>
    commitClip(state, id, copy, track),
  "consolidate-time": (state, { time }) => consolidateTime(state, time),
  "clear-selection": (state) => withSelection(state, null),
  "clear-time": (state, { time }) =>
    edit(state, (doc) => ({
      ...doc,
      clips: clearTime(doc.clips, time, state.doc.duration),
    })),
  "crop-clip": (state, { id }) => cropOne(state, id),
  "duplicate-selection": (state) =>
    duplicateClips(
      state,
      state.doc.clips.filter((clip) =>
        (state.selection?.clips ?? NONE).includes(clip.id)
      )
    ),
  "duplicate-track": (state, { id }) => duplicateTrack(state, id),
  "edit-clip": (state, { id, change }) =>
    burst(state, (doc) => ({
      ...doc,
      clips: doc.clips.map((clip) => (clip.id === id ? change(clip) : clip)),
    })),
  "fade-time": (state, { time }) =>
    edit(state, (doc) => ({ ...doc, clips: fadeTime(doc.clips, time) })),
  "insert-time": (state, { at, length }) =>
    edit(state, (doc) => ({
      ...doc,
      clips: openTime(doc.clips, at, length, state.doc.duration),
    })),
  "group-tracks": (state, { ids, name }) => groupTracks(state, ids, name),
  "move-track": (state, { id, index }) => moveTrack(state, id, index),
  ungroup: (state, { id }) => ungroup(state, id),
  paste: (state, { clipping, at, track }) => paste(state, clipping, at, track),
  redo: (state) => restore(state, redo(state.history, state.doc)),
  "release-clips": (state) => releaseClips(state),
  "remove-clip": (state, { id }) => removeClip(state, id),
  "remove-time": (state, { from, to }) =>
    edit(state, (doc) => ({
      ...doc,
      clips: deleteTime(doc.clips, from, to, state.doc.duration),
    })),
  "remove-track": (state, { id }) => removeTrack(state, id),
  "rename-clip": (state, { id, name }) => renameClip(state, id, name),
  "rename-track": (state, { id, name }) => renameTrack(state, id, name),
  "select-all": (state) => selectAll(state),
  "select-clip": (state, { id, additive }) => selectClip(state, id, additive),
  "select-clips": (state, { ids }) =>
    withSelection(state, { clips: ids, tracks: [] }),
  "select-track": (state, { id, additive }) => selectTrack(state, id, additive),
  "set-duration": (state, { duration }) =>
    state.doc.duration === duration
      ? state
      : { ...state, doc: { ...state.doc, duration } },
  "set-fade-shape": (state, { id, edge, shape }) =>
    fadeShape(state, id, edge, shape),
  "settle-clip-edit": (state) => ({
    ...state,
    history: settleChange(state.history),
  }),
  "split-cursor": (state, { at, step }) => splitAtCursor(state, at, step),
  "toggle-selected": (state) => {
    const [first] = state.selection?.clips ?? NONE;
    return first
      ? toggleClips(state, first, state.selection?.clips ?? NONE)
      : state;
  },
  undo: (state) => restore(state, undo(state.history, state.doc)),
};

/** Takes a command the host sends and returns the state after it: the one place the arrangement changes. */
export function apply(
  state: ArrangementState,
  command: ArrangementCommand
): ArrangementState {
  // Every command type has its handler in `handlers`, which takes that command's own fields.
  const handle = handlers[command.type] as (
    state: ArrangementState,
    command: ArrangementCommand
  ) => ArrangementState;
  return handle(state, command);
}

/** What a copy holds: the stretch of time on its tracks, or else the selected clips, whole. */
export function copyFrom(
  state: ArrangementState,
  time: TimeSelection | null
): Clipping {
  const order = trackOrder(state.doc);
  if (time) {
    return copyTime(state.doc.clips, time, order, state.doc.duration);
  }
  const selected = state.selection?.clips ?? NONE;
  return copyClips(
    state.doc.clips.filter((clip) => selected.includes(clip.id)),
    order,
    state.doc.duration
  );
}
