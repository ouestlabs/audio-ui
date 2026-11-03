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
  const soloedTracks = new Set(
    tracks
      .filter((track) => track.soloed && track.kind === "track")
      .map((track) => track.id)
  );
  const soloedReturns = new Set(
    tracks
      .filter((track) => track.soloed && track.kind === "return")
      .map((track) => track.id)
  );
  const returns = new Set(
    tracks.filter((track) => track.kind === "return").map((track) => track.id)
  );
  const any = soloedTracks.size + soloedReturns.size > 0;
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
