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
} from "@audio-ui/react";
import {
  type Arranged,
  type ArrangementTrack,
  type AutomatedParameter,
  type ClipAction,
  type Clipping,
  type Mix,
  mixOf,
  type TimeSelection,
  type TrackKind,
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
 * A clip at a new tempo, `ratio` times as long: where it sits and its source.
 * A MIDI clip's notes and loop are in beats at heart, so they follow the
 * tempo too; a recording's loop stays where it is in the recording.
 */
export function scaleClip(clip: Arranged, ratio: number): Arranged {
  const scaled: Arranged = {
    ...clip,
    sourceLength: clip.sourceLength * ratio,
    value: scaleValue(clip.value, ratio),
  };
  if (!clip.notes) {
    return scaled;
  }
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

export function createArrangementState({
  colors,
  duration,
  initialClips = [],
  initialLocators = [],
  initialLoop = { on: false, range: [0, 0] },
  initialSignatures = [],
  initialTracks,
  tempo,
}: {
  colors: number;
  duration: number;
  initialClips?: Arranged[];
  initialLocators?: ArrangementLocator[];
  initialLoop?: ArrangementLoop;
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
  // Time: the tempo, the signatures, the locators and the loop.
  | { type: "add-locator"; at: number }
  | { type: "add-signature"; at: number }
  /** A drag of the loop: a burst, which `settle-clip-edit` closes into one step. */
  | { type: "change-loop"; range: Span }
  /** A drag of a header's gain or pan: a burst, which `settle-clip-edit` closes into one step. */
  | { type: "change-mix"; id: string; patch: Partial<Omit<Mix, "color">> }
  | { type: "move-signature"; id: string; to: number }
  | { type: "remove-locator"; at: number }
  | { type: "remove-signature"; id: string }
  | { type: "rename-locator"; at: number; name: string }
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
  | { type: "add-track"; afterId?: string; kind?: TrackKind }
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
  | { type: "move-track"; id: string; index: number }
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

/** A new id for a piece of the clip `id`: the first `-n` that no clip in `taken` has. */
function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** Whether a change made nothing: the same clips and tracks, item for item. */
function sameDoc(a: ArrangementDoc, b: ArrangementDoc): boolean {
  return (
    sameItems(a.clips, b.clips) &&
    sameItems(a.tracks, b.tracks) &&
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

/** What one kind of command does to the state: its handler, given the command with its own fields. */
type Handlers = {
  [K in ArrangementCommand["type"]]: (
    state: ArrangementState,
    command: Extract<ArrangementCommand, { type: K }>
  ) => ArrangementState;
};

function duplicateTrack(state: ArrangementState, id: string): ArrangementState {
  const source = state.doc.tracks.find((item) => item.id === id);
  if (!source) {
    return state;
  }
  const count = state.trackCount + 1;
  const copy: ArrangementTrack = {
    ...source,
    id: `track-${count}`,
    name: `${source.name} copy`,
  };
  const next = edit(state, (doc) => {
    const tracks = [...doc.tracks];
    tracks.splice(tracks.findIndex((item) => item.id === id) + 1, 0, copy);
    const taken = new Set(doc.clips.map((clip) => clip.id));
    const copies = doc.clips
      .filter((clip) => clip.track === id)
      .map((clip) => ({
        ...clip,
        id: freshId(clip.id, taken),
        track: copy.id,
      }));
    return { ...doc, clips: [...doc.clips, ...copies], tracks };
  });
  return { ...next, trackCount: count };
}

function moveTrack(
  state: ArrangementState,
  id: string,
  index: number
): ArrangementState {
  return edit(state, (doc) => {
    const from = doc.tracks.findIndex((item) => item.id === id);
    if (from === -1 || from === index) {
      return doc;
    }
    const tracks = [...doc.tracks];
    const [moved] = tracks.splice(from, 1);
    tracks.splice(
      Math.min(Math.max(index, 0), tracks.length),
      0,
      moved as ArrangementTrack
    );
    return { ...doc, tracks };
  });
}

function changeTrack(
  state: ArrangementState,
  id: string,
  change: (track: ArrangementTrack) => ArrangementTrack,
  write: typeof edit
): ArrangementState {
  return write(state, (doc) => ({
    ...doc,
    tracks: doc.tracks.map((track) =>
      track.id === id ? change(track) : track
    ),
  }));
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
  const track = state.doc.tracks.find((item) => item.id === id);
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
  if (!next || next === state.doc.tracks.find((item) => item.id === id)?.name) {
    return state;
  }
  return edit(state, (doc) => ({
    ...doc,
    tracks: doc.tracks.map((item) =>
      item.id === id ? { ...item, name: next } : item
    ),
  }));
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
  // A track among the tracks picked takes the others with it.
  const picked = state.selection?.tracks ?? NONE;
  const gone = picked.includes(id) ? picked : [id];
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
    clips: doc.clips.map((clip) => scaleClip(clip, ratio)),
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

function renameLocator(
  state: ArrangementState,
  at: number,
  name: string
): ArrangementState {
  if (state.doc.locators.find((locator) => locator.at === at)?.name === name) {
    return state;
  }
  return edit(state, (doc) => ({
    ...doc,
    locators: doc.locators.map((locator) =>
      locator.at === at ? { ...locator, name } : locator
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
              { at, name: `Locator ${doc.locators.length + 1}` },
            ],
          }
    ),
  "add-signature": (state, { at }) => addSignature(state, at),
  "add-track": (state, { afterId, kind = "audio" }) => {
    const count = state.trackCount + 1;
    const track: ArrangementTrack = {
      color: (count - 1) % state.colors,
      id: `track-${count}`,
      kind,
      name: `${kind === "midi" ? "MIDI" : "Track"} ${count}`,
    };
    const next = edit(state, (doc) => {
      const at = afterId
        ? doc.tracks.findIndex((item) => item.id === afterId) + 1
        : doc.tracks.length;
      const tracks = [...doc.tracks];
      tracks.splice(at || doc.tracks.length, 0, track);
      return { ...doc, tracks };
    });
    return { ...next, trackCount: count };
  },
  "change-automation": (state, { trackId, parameter, points }) =>
    changeAutomation(state, trackId, parameter, points),
  "change-clip": (state, { id, value, details }) =>
    changeClip(state, id, value, details),
  "change-loop": (state, { range }) => changeLoop(state, range),
  "change-mix": (state, { id, patch }) => setMix(state, id, patch, burst),
  "move-signature": (state, { id, to }) =>
    changeSignature(state, id, (change) => ({
      ...change,
      at: Math.min(state.doc.duration, Math.max(0, to)),
    })),
  "remove-locator": (state, { at }) =>
    edit(state, (doc) => ({
      ...doc,
      locators: doc.locators.filter((locator) => locator.at !== at),
    })),
  "remove-signature": (state, { id }) =>
    edit(state, (doc) => ({
      ...doc,
      signatures: doc.signatures.filter((change) => change.id !== id),
    })),
  "rename-locator": (state, { at, name }) => renameLocator(state, at, name),
  "set-loop": (state, { loop }) => setLoop(state, loop),
  "set-mix": (state, { id, patch }) => setMix(state, id, patch, edit),
  "set-track-color": (state, { id, color }) =>
    state.doc.tracks.find((item) => item.id === id)?.color === color
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
  "move-track": (state, { id, index }) => moveTrack(state, id, index),
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
