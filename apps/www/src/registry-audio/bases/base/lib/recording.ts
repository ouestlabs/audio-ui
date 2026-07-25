/**
 * Framework-free helpers for microphone recording — the pure decisions behind
 * `use-mic-recorder`, kept out of any `"use client"` surface so they stay
 * testable without a browser.
 */

/**
 * Container/codec preferences, best first. Browsers disagree on what
 * `MediaRecorder` accepts — Chrome/Firefox record WebM/Opus, Safari only
 * MP4/AAC — so a recorder tries these in order rather than assuming one.
 */
export const RECORDER_MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

/**
 * The first preference the platform actually supports, or `undefined` to let
 * `MediaRecorder` fall back to its own default. `isSupported` is injected
 * (normally `MediaRecorder.isTypeSupported`) so this stays pure and testable.
 */
export function pickRecorderMimeType(
  isSupported: (type: string) => boolean,
  preferences: readonly string[] = RECORDER_MIME_PREFERENCES
): string | undefined {
  for (const type of preferences) {
    if (isSupported(type)) {
      return type;
    }
  }
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** Elapsed recording time as `m:ss`. Negative or non-finite input reads as `0:00`. */
export function formatRecordingTime(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return "0:00";
  }
  const totalSeconds = Math.floor(elapsedMs / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** A finished recording — the audio itself plus what a UI needs to present it. */
export interface Recording {
  blob: Blob;
  durationMs: number;
  mimeType: string;
  /** Object URL for playback; revoked when the recorder is cleared or replaced. */
  url: string;
}
