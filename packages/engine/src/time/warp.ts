/**
 * Warping: markers that pin a time in a recording (its source) to a time on
 * the clip it plays in (its target). Between two markers the recording is
 * stretched or squeezed evenly to fit, so a beat in it lands on the beat of
 * the song; past the first and the last, it keeps the speed of the stretch
 * next to it. Played by changing speed alone, a stretch also changes pitch,
 * as a turntable does.
 */

/** A time in the source, pinned to a time on the clip. */
export interface WarpMarker {
  source: number;
  target: number;
}

/** How close two markers may be, in either time. */
const GAP = 1e-6;

/**
 * The markers that make a map: finite ones, in order, each later than the one
 * before in both times. One that would run back in either time is left out.
 */
export function warpMarkers(markers: readonly WarpMarker[]): WarpMarker[] {
  const sorted = markers
    .filter(
      (marker) =>
        Number.isFinite(marker.source) && Number.isFinite(marker.target)
    )
    .sort((a, b) => a.source - b.source);
  const kept: WarpMarker[] = [];
  for (const marker of sorted) {
    const last = kept.at(-1);
    if (
      !last ||
      (marker.source > last.source + GAP && marker.target > last.target + GAP)
    ) {
      kept.push(marker);
    }
  }
  return kept;
}

/** Maps a time from one side to the other, along the stretches between the markers. */
function along(
  markers: readonly WarpMarker[],
  time: number,
  from: "source" | "target",
  to: "source" | "target"
): number {
  const map = warpMarkers(markers);
  const [first, second] = map;
  if (!first) {
    return time;
  }
  if (!second) {
    return time - first[from] + first[to];
  }
  // The stretch that holds `time`, or the first or last one past the ends.
  let index = 0;
  while (
    index < map.length - 2 &&
    time >= (map[index + 1] as WarpMarker)[from]
  ) {
    index += 1;
  }
  const a = map[index] as WarpMarker;
  const b = map[index + 1] as WarpMarker;
  return a[to] + ((time - a[from]) * (b[to] - a[to])) / (b[from] - a[from]);
}

/** Where on the clip a time in the source plays. */
export function warpedTime(
  markers: readonly WarpMarker[],
  source: number
): number {
  return along(markers, source, "source", "target");
}

/** What time in the source plays at a time on the clip. */
export function unwarpedTime(
  markers: readonly WarpMarker[],
  target: number
): number {
  return along(markers, target, "target", "source");
}

/**
 * How fast the source plays at a time on the clip: 1 as recorded, 2 twice as
 * fast. Played by speed alone, it is also how far the pitch moves: a rate of 2
 * is an octave up.
 */
export function warpRate(
  markers: readonly WarpMarker[],
  target: number
): number {
  const step = 1e-3;
  return (
    (unwarpedTime(markers, target + step) - unwarpedTime(markers, target)) /
    step
  );
}

/** Adds a marker at a time on the clip, pinning what plays there; nothing changes in how it plays until it moves. */
export function addWarpMarker(
  markers: readonly WarpMarker[],
  target: number
): WarpMarker[] {
  return warpMarkers([
    ...markers,
    { source: unwarpedTime(markers, target), target },
  ]);
}

/**
 * Moves the marker at `index` to a new time on the clip, stretching the
 * recording on either side of it: it stops short of its neighbours.
 */
export function moveWarpMarker(
  markers: readonly WarpMarker[],
  index: number,
  target: number
): WarpMarker[] {
  const map = warpMarkers(markers);
  const marker = map[index];
  if (!(marker && Number.isFinite(target))) {
    return map;
  }
  const earliest =
    (map[index - 1]?.target ?? Number.NEGATIVE_INFINITY) + GAP * 2;
  const latest = (map[index + 1]?.target ?? Number.POSITIVE_INFINITY) - GAP * 2;
  const next = [...map];
  next[index] = {
    ...marker,
    target: Math.min(latest, Math.max(earliest, target)),
  };
  return next;
}

/** Takes the marker at `index` away, as long as two are left to make a map. */
export function removeWarpMarker(
  markers: readonly WarpMarker[],
  index: number
): WarpMarker[] {
  const map = warpMarkers(markers);
  return map.length > 2 ? map.filter((_, at) => at !== index) : map;
}

/** Plays the whole map `factor` times as long: 2 is half the speed, an octave down; 0.5 twice the speed. */
export function scaleWarp(
  markers: readonly WarpMarker[],
  factor: number
): WarpMarker[] {
  const map = warpMarkers(markers);
  if (!(Number.isFinite(factor) && factor > 0)) {
    return map;
  }
  const origin = map[0]?.target ?? 0;
  return map.map((marker) => ({
    ...marker,
    target: origin + (marker.target - origin) * factor,
  }));
}
