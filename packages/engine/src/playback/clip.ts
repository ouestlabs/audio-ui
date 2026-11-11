import type { FadeShape } from "@audio-ui/core/timeline";
import { dbToGain } from "../analysis/level.ts";
import { type WarpMarker, warpedTime, warpMarkers } from "../time/warp.ts";
import { toFrames } from "./transport.ts";

/**
 * An audio clip as an arrangement stores it, in seconds: the fields a player
 * needs, so any host's clip with these fields can be played.
 */
/** How a clip plays at another speed than its recording's: with its pitch moving with it, in slices that keep their attacks, or in grains that keep a held note. */
export type WarpMode = "beats" | "repitch" | "tones";

/** How long the slices of Beats last by default, in seconds: a sixteenth note at 120 BPM. */
const BEATS_GRAIN_SECONDS = 0.125;
/** How far apart the grains of Tones start, in seconds. */
const TONES_HOP_SECONDS = 0.03;
/** The crossfade between two slices of Beats, in seconds. */
const BEATS_FADE_SECONDS = 0.004;

/** How a clip stretches time, in frames of the arrangement: how far apart its grains start and how long they cross, how fast each reads, and whether each is lined up on the last. */
export interface PlayedStretch {
  aligned: boolean;
  fade: number;
  hop: number;
  speed: number;
}

/** An audio clip as an arrangement holds it, in seconds: where it lies, the stretch of its recording it plays, its gain, loop, direction and warp. */
export interface ArrangedAudio {
  /** A deactivated clip stays where it is and plays nothing. */
  disabled?: boolean;
  /** How much louder or quieter it plays, in dB. @default 0 */
  gain?: number;
  /** A stretch of what it plays, `[start, end]` in its own time, that repeats for as long as it lasts. */
  loop?: readonly [number, number];
  /** Whether what it plays is mirrored: its own time runs backwards through its source. */
  reversed?: boolean;
  /** Where its source begins in the recording, in seconds of the recording. @default 0 */
  sourceFrom?: number;
  /** How long its source is, in seconds of the recording. */
  sourceLength: number;
  /** In Beats or Tones: how many semitones from its pitch it plays, at the speed it has. @default 0 */
  transpose?: number;
  /** Where it lies, where it starts in what it plays, and its fades. */
  value: {
    fadeIn: number;
    fadeInShape?: FadeShape;
    fadeOut: number;
    fadeOutShape?: FadeShape;
    length: number;
    offset: number;
    start: number;
  };
  /** Markers pinning times of its source (from `sourceFrom`) to times of its own: the source is stretched between them, its pitch with its speed. */
  warp?: readonly WarpMarker[];
  /** In Beats: how long a slice lasts, in seconds. @default 0.125 */
  warpGrain?: number;
  /** How it plays at another speed than its recording's. @default "repitch" */
  warpMode?: WarpMode;
}

/**
 * An audio clip as a player reads it: in whole frames of the arrangement, at
 * the engine's sample rate. Its own time is what it plays, before its warp
 * and its mirror: at the arrangement's frame `t` it plays its own frame
 * `t + shift`, folded into its loop. The pieces of a split share their shift,
 * which is what makes a split seamless.
 */
export interface PlayedClip {
  /** The arrangement's frame it stops at, exclusive. */
  end: number;
  /** Frames of fade from its start. */
  fadeIn: number;
  fadeInShape: FadeShape;
  /** Frames of fade up to its end. */
  fadeOut: number;
  fadeOutShape: FadeShape;
  /** Its gain, as a ratio. */
  gain: number;
  /** The loop in its own frames, `[start, end)`. */
  loop: readonly [number, number] | null;
  /** The id of the recording it plays. */
  recording: string;
  reversed: boolean;
  /** Its own frame at the arrangement's frame 0. */
  shift: number;
  /** Where its source begins in the recording, in seconds. */
  sourceFrom: number;
  /** How long its source lasts in its own frames: what a reversed clip is mirrored across. */
  span: number;
  /** The arrangement's frame it starts at. */
  start: number;
  /** How it stretches time; `null` when it plays through in one piece. */
  stretch: PlayedStretch | null;
  /** Its warp markers, kept in order, in seconds; `null` when it plays its source as recorded. */
  warp: readonly WarpMarker[] | null;
}

/**
 * The clip a player reads from `clip`, playing the recording `recording`, at
 * `sampleRate`: every time turned into the nearest frame, the fades shortened
 * to fit, the gain as a ratio.
 */
export function playedClip(
  clip: ArrangedAudio,
  recording: string,
  sampleRate: number
): PlayedClip {
  const { value } = clip;
  const start = toFrames(value.start, sampleRate);
  const end = Math.max(start, toFrames(value.start + value.length, sampleRate));
  const length = end - start;
  const fadeIn = Math.min(
    length,
    Math.max(0, toFrames(value.fadeIn, sampleRate))
  );
  const fadeOut = Math.min(
    length - fadeIn,
    Math.max(0, toFrames(value.fadeOut, sampleRate))
  );
  const warp = clip.warp && clip.warp.length > 0 ? warpMarkers(clip.warp) : [];
  const loop = clip.loop
    ? ([
        toFrames(clip.loop[0], sampleRate),
        toFrames(clip.loop[1], sampleRate),
      ] as const)
    : null;
  return {
    end,
    fadeIn,
    fadeInShape: value.fadeInShape ?? "linear",
    fadeOut,
    fadeOutShape: value.fadeOutShape ?? "linear",
    gain: dbToGain(clip.gain ?? 0),
    loop: loop && loop[1] > loop[0] ? loop : null,
    recording,
    reversed: Boolean(clip.reversed),
    shift: toFrames(value.offset - value.start, sampleRate),
    sourceFrom: clip.sourceFrom ?? 0,
    span: toFrames(
      warp.length > 0 ? warpedTime(warp, clip.sourceLength) : clip.sourceLength,
      sampleRate
    ),
    start,
    stretch: stretchOf(clip, warp.length > 0, sampleRate),
    warp: warp.length > 0 ? warp : null,
  };
}

/** How `clip` stretches time: not at all in Repitch, nor with nothing to stretch. */
function stretchOf(
  clip: ArrangedAudio,
  warped: boolean,
  sampleRate: number
): PlayedStretch | null {
  const { transpose = 0, warpGrain, warpMode = "repitch" } = clip;
  if (warpMode === "repitch" || !(warped || transpose !== 0)) {
    return null;
  }
  const speed = 2 ** (transpose / 12);
  if (warpMode === "tones") {
    const hop = Math.max(1, toFrames(TONES_HOP_SECONDS, sampleRate));
    return { aligned: true, fade: hop, hop, speed };
  }
  const hop = Math.max(
    1,
    toFrames(warpGrain ?? BEATS_GRAIN_SECONDS, sampleRate)
  );
  return {
    aligned: false,
    fade: Math.min(hop, toFrames(BEATS_FADE_SECONDS, sampleRate)),
    hop,
    speed,
  };
}

/**
 * Reads a warp map from a clip's own time back to its source's, fast enough
 * to be asked for every frame: it keeps the stretch it last answered from,
 * since frames come in order. `markers` must be in order (`warpMarkers`).
 */
export function createWarpReader(
  markers: readonly WarpMarker[]
): (target: number) => number {
  let index = 0;
  return (target) => {
    const [first, second] = markers;
    if (!first) {
      return target;
    }
    if (!second) {
      return target - first.target + first.source;
    }
    const last = markers.length - 2;
    while (index > 0 && target < (markers[index] as WarpMarker).target) {
      index -= 1;
    }
    while (
      index < last &&
      target >= (markers[index + 1] as WarpMarker).target
    ) {
      index += 1;
    }
    const a = markers[index] as WarpMarker;
    const b = markers[index + 1] as WarpMarker;
    return (
      a.source +
      ((target - a.target) * (b.source - a.source)) / (b.target - a.target)
    );
  };
}

/**
 * The clips a track's player reads, from an arrangement's audio clips: those
 * that play (not deactivated, with a recording to play), each through
 * `playedClip`, in the order they start.
 */
export function playedClips<Clip extends ArrangedAudio>(
  clips: readonly Clip[],
  recordingOf: (clip: Clip) => string | undefined,
  sampleRate: number
): PlayedClip[] {
  const played: PlayedClip[] = [];
  for (const clip of clips) {
    const recording = recordingOf(clip);
    if (!clip.disabled && recording !== undefined) {
      played.push(playedClip(clip, recording, sampleRate));
    }
  }
  return played.sort((a, b) => a.start - b.start);
}
