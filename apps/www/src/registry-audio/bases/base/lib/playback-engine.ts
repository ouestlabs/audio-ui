const PLAYBACK_RATE_MIN = 0.25;
const PLAYBACK_RATE_MAX = 2;

/**
 * Valid playback-rate range is a product decision (acceptable listening
 * speeds), not a device constraint — the audio-store is the only place
 * this clamps. See docs/adr/0002-store-owns-playback-rate-clamp.md.
 */
export function clampPlaybackRate(rate: number): number {
  return Math.max(PLAYBACK_RATE_MIN, Math.min(PLAYBACK_RATE_MAX, rate));
}

/**
 * Whether a duration value indicates a live stream. Should only be trusted
 * once metadata has loaded (`readyState >= HAVE_METADATA`) — `duration === 0`
 * just means duration isn't loaded yet, not that the stream is live.
 */
export function isLive(duration: number): boolean {
  if (duration === 0) {
    return false;
  }
  return (
    Number.isNaN(duration) ||
    duration === Number.POSITIVE_INFINITY ||
    duration === Number.NEGATIVE_INFINITY
  );
}

export type PlaybackEngineEventType =
  | "play"
  | "pause"
  | "playing"
  | "waiting"
  | "loadstart"
  | "canplay"
  | "canplaythrough"
  | "timeupdate"
  | "durationchange"
  | "volumechange"
  | "ended"
  | "error"
  | "bufferupdate";

export type LoadEngineParams = {
  url: string;
  startTime?: number;
  isLiveStream?: boolean;
};

export type SetEngineVolumeParams = {
  volume: number;
  fadeTime?: number;
};

/** Detail payload of the `"error"` event — the engine has already inspected
 * its native error object; callers never need to. */
export type PlaybackEngineErrorDetail = {
  message: string;
  recoverable: boolean;
  errorCode: number;
};

/**
 * The seam between the audio-store (domain: queue, playback intent) and a
 * concrete audio backend. Commands flow in, events flow out through this one
 * interface — no caller reaches past it into a raw `HTMLAudioElement` (there
 * is deliberately no `getAudioElement()` here). `HtmlAudioEngine` is the
 * production adapter; `FakeEngine` is the in-memory test adapter.
 */
export interface PlaybackEngine {
  addEventListener(
    type: PlaybackEngineEventType,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void;
  getBufferedRanges(): TimeRanges | null;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  getSource(): string;
  getVolume(): number;
  init(): void;
  isMuted(): boolean;
  isPaused(): boolean;
  load(params: LoadEngineParams): Promise<void>;
  pause(): void;
  play(): Promise<void>;
  removeEventListener(
    type: PlaybackEngineEventType,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void;
  setCurrentTime(time: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  setVolume(params: SetEngineVolumeParams): void;
}
