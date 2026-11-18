/**
 * The mixer's arithmetic: how a pan sets two gains, which tracks a solo lets
 * through, and how long each path waits so that every one reaches the main
 * track at the same frame. No audio in it: a host's engine applies it.
 */

/**
 * The gains of the left and right channels for a pan from -1 (left) to 1
 * (right): a constant-power law on sine curves, with both channels at unity
 * in the centre and the side it is turned to at +3 dB at either end. Each
 * channel has its own gain, so nothing of one moves into the other.
 */
export function panGains(pan: number): readonly [left: number, right: number] {
  const clamped = Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0;
  const angle = ((clamped + 1) * Math.PI) / 4;
  return [Math.SQRT2 * Math.cos(angle), Math.SQRT2 * Math.sin(angle)];
}

/** A track as the solo sees it. */
export interface SoloTrack {
  /** The group track it plays into, if any: a group is heard while a track in it is soloed, and a soloed group lets its tracks be heard. */
  group?: string | null;
  id: string;
  /** A return track carries what the others send it. */
  kind: "return" | "track";
  soloed: boolean;
}

/** What a solo lets through: each track's own output, and each of its sends. */
export interface SoloState {
  /** Whether a track's output (to the main track) is heard. */
  heard: (track: string) => boolean;
  /** Whether a track's send to a return passes. */
  sends: (track: string, to: string) => boolean;
}

/**
 * The tracks a solo lets through, once groups are counted: the soloed ones,
 * the groups each sits in (which carry its sound), and the tracks of a soloed
 * group.
 */
function withGroups(
  tracks: readonly SoloTrack[],
  soloed: ReadonlySet<string>
): Set<string> {
  const groupOf = new Map(
    tracks.map((track) => [track.id, track.group ?? null])
  );
  const ancestors = (id: string) => {
    const found: string[] = [];
    let at = groupOf.get(id) ?? null;
    while (at !== null && !found.includes(at)) {
      found.push(at);
      at = groupOf.get(at) ?? null;
    }
    return found;
  };
  const heard = new Set<string>();
  for (const track of tracks) {
    const up = ancestors(track.id);
    if (soloed.has(track.id) || up.some((group) => soloed.has(group))) {
      heard.add(track.id);
      for (const group of up) {
        heard.add(group);
      }
    }
  }
  return heard;
}

/**
 * Which tracks a solo silences. Nothing soloed, everything plays. Soloed
 * tracks are heard and every other track is silenced, its sends with it; the
 * return tracks stay heard when `inPlace` is on, so a soloed track keeps its
 * reverb. A soloed return is heard with what the others send it, while their
 * own outputs are silenced. The main track is not a track here: it is always
 * heard.
 */
export function soloState(
  tracks: readonly SoloTrack[],
  { inPlace = true }: { inPlace?: boolean } = {}
): SoloState {
  const soloedTracks = withGroups(
    tracks.filter((track) => track.kind === "track"),
    new Set(
      tracks
        .filter((track) => track.soloed && track.kind === "track")
        .map((track) => track.id)
    )
  );
  const soloedReturns = new Set(
    tracks
      .filter((track) => track.soloed && track.kind === "return")
      .map((track) => track.id)
  );
  const returns = new Set(
    tracks.filter((track) => track.kind === "return").map((track) => track.id)
  );
  const any =
    tracks.some((track) => track.soloed && track.kind === "track") ||
    soloedReturns.size > 0;
  return {
    heard: (track) => {
      if (!any) {
        return true;
      }
      if (returns.has(track)) {
        return (
          soloedReturns.has(track) ||
          (inPlace && soloedReturns.size === 0 && soloedTracks.size > 0)
        );
      }
      return soloedTracks.has(track);
    },
    sends: (track, to) =>
      !any || soloedTracks.has(track) || soloedReturns.has(to),
  };
}

/** A path into the mixer as delay compensation sees it: how many frames its devices delay it. */
export interface DelayedTrack {
  id: string;
  /** The frames its device chain delays it. */
  latency: number;
}

/** How long each path waits, in frames, so that all of them line up at the main track. */
export interface Compensation {
  /** What waits after each return's chain. */
  returns: ReadonlyMap<string, number>;
  /** The frames the whole mix comes out late: the slowest track's chain, then the slowest return's. */
  total: number;
  /** What waits after each track's chain (its sends tap after it), and then on its way to the main track alone. */
  tracks: ReadonlyMap<string, { chain: number; main: number }>;
}

/**
 * The waits that line every path up at the main track. Each track waits after
 * its chain for the slowest track's chain, so all their outputs and all their
 * sends leave in step; each return waits after its chain for the slowest
 * return's; and a track's own output then waits that long again, so it meets
 * the returns at the main track. Latencies that are not whole positive
 * frames count as none.
 */
export function delayCompensation(
  tracks: readonly DelayedTrack[],
  returns: readonly DelayedTrack[]
): Compensation {
  const frames = (latency: number) =>
    Number.isFinite(latency) && latency > 0 ? Math.round(latency) : 0;
  const slowestTrack = Math.max(
    0,
    ...tracks.map((track) => frames(track.latency))
  );
  const slowestReturn = Math.max(
    0,
    ...returns.map((track) => frames(track.latency))
  );
  return {
    returns: new Map(
      returns.map((track) => [track.id, slowestReturn - frames(track.latency)])
    ),
    total: slowestTrack + slowestReturn,
    tracks: new Map(
      tracks.map((track) => [
        track.id,
        { chain: slowestTrack - frames(track.latency), main: slowestReturn },
      ])
    ),
  };
}

/** A path into the mixer as routing sees it: its delay, where it plays into, and the returns it sends to. */
export interface RoutedTrack extends DelayedTrack {
  /** The group track it plays into; none, or one that is not a track, is the main track. */
  group?: string | null;
  /** The return tracks it sends to. */
  sends?: readonly string[];
}

/** How long each path waits, in frames, so that everything meeting anywhere meets on the same frame. */
export interface RoutedCompensation {
  /** What waits on the way from each track, group and return to where it plays into. */
  out: ReadonlyMap<string, number>;
  /** What waits on each send, by the track that sends, then the return it reaches. */
  sends: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** The frames the whole mix comes out late. */
  total: number;
}

/**
 * The waits that line every path up wherever paths meet: at a group, the
 * sound of each of its tracks; at a return, each send; at the main track, the
 * top tracks and groups and the returns. A path is ready when its sound has
 * come through its own chain after everything that plays into it; each that
 * is ready sooner than the slowest waits the difference on its way. Groups
 * can hold groups; a group that would hold itself counts as playing into the
 * main track. Latencies that are not whole positive frames count as none.
 */
export function routedCompensation(
  tracks: readonly RoutedTrack[],
  returns: readonly DelayedTrack[]
): RoutedCompensation {
  const frames = (latency: number) =>
    Number.isFinite(latency) && latency > 0 ? Math.round(latency) : 0;
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const parentOf = (track: RoutedTrack) => {
    const group = track.group ?? null;
    return group !== null && group !== track.id && byId.has(group)
      ? group
      : null;
  };
  const children = new Map<string, RoutedTrack[]>();
  for (const track of tracks) {
    const parent = parentOf(track);
    if (parent !== null) {
      children.set(parent, [...(children.get(parent) ?? []), track]);
    }
  }
  const ready = new Map<string, number>();
  const readyOf = (track: RoutedTrack, seen: ReadonlySet<string>): number => {
    const known = ready.get(track.id);
    if (known !== undefined) {
      return known;
    }
    const inner = (children.get(track.id) ?? []).filter(
      (child) => !seen.has(child.id)
    );
    const next = new Set([...seen, track.id]);
    const arrives = Math.max(0, ...inner.map((child) => readyOf(child, next)));
    const done = arrives + frames(track.latency);
    ready.set(track.id, done);
    return done;
  };
  for (const track of tracks) {
    readyOf(track, new Set());
  }
  const out = new Map<string, number>();
  const sends = new Map<string, Map<string, number>>();
  for (const track of tracks) {
    const parent = parentOf(track);
    if (parent !== null) {
      const arrives =
        (ready.get(parent) ?? 0) - frames(byId.get(parent)?.latency ?? 0);
      out.set(track.id, arrives - (ready.get(track.id) ?? 0));
    }
  }
  const returnReady = new Map<string, number>();
  for (const back of returns) {
    const senders = tracks.filter((track) => track.sends?.includes(back.id));
    const arrives = Math.max(
      0,
      ...senders.map((track) => ready.get(track.id) ?? 0)
    );
    for (const sender of senders) {
      const waits = sends.get(sender.id) ?? new Map<string, number>();
      waits.set(back.id, arrives - (ready.get(sender.id) ?? 0));
      sends.set(sender.id, waits);
    }
    returnReady.set(back.id, arrives + frames(back.latency));
  }
  const top = tracks.filter((track) => parentOf(track) === null);
  const total = Math.max(
    0,
    ...top.map((track) => ready.get(track.id) ?? 0),
    ...returnReady.values()
  );
  for (const track of top) {
    out.set(track.id, total - (ready.get(track.id) ?? 0));
  }
  for (const [id, done] of returnReady) {
    out.set(id, total - done);
  }
  return { out, sends, total };
}
