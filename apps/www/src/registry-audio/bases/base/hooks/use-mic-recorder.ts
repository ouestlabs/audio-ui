"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";
import {
  pickRecorderMimeType,
  type Recording,
} from "@/registry-audio/bases/base/lib/recording";

/** How often the elapsed-time readout ticks while recording. */
const DURATION_TICK_MS = 100;
/** Analyser resolution — enough detail for a level meter without oversampling. */
const ANALYSER_FFT_SIZE = 2048;

export type MicPermission = "idle" | "granted" | "denied";

export interface UseMicRecorderOptions {
  /** Fired once a recording finishes and its blob is ready. */
  onStop?: (recording: Recording) => void;
}

export interface UseMicRecorderReturn {
  /** Live analyser for the incoming mic signal — pass `[analyser]` to `useAudioLevels` to drive a Meter, or read it for a live waveform. Null while idle. */
  analyser: AnalyserNode | null;
  /** Discards the current recording and revokes its object URL. */
  clear: () => void;
  /** Elapsed recording time in milliseconds, ticking while active. */
  durationMs: number;
  /** Why recording could not start (permission refused, no device, unsupported browser). */
  error: string | null;
  isPaused: boolean;
  isRecording: boolean;
  pause: () => void;
  permission: MicPermission;
  /** The finished recording, or null before the first one. */
  recording: Recording | null;
  resume: () => void;
  /** Requests mic access if needed, then starts capturing. */
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Microphone capture behind one interface: it asks for mic access, records via
 * `MediaRecorder` (picking a container the platform actually supports), tracks
 * elapsed time, exposes a live `AnalyserNode` for metering or a recording
 * waveform, and hands back a finished `Recording` with an object URL it owns —
 * revoking the previous one so a long session never leaks. Callers never touch
 * `getUserMedia`, the recorder, or the media stream directly.
 */
export function useMicRecorder(
  options: UseMicRecorderOptions = {}
): UseMicRecorderReturn {
  const webAudio = useWebAudio();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState<MicPermission>("idle");
  const [recording, setRecording] = useState<Recording | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const pausedMsRef = useRef(0);
  const pausedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);
  const onStopRef = useRef(options.onStop);
  onStopRef.current = options.onStop;

  /** Tears down the capture graph — recorder, mic tracks, analyser — without touching the finished recording. */
  const teardown = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    recorderRef.current = null;
    setAnalyser(null);
  }, []);

  const clear = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setRecording(null);
    setDurationMs(0);
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) {
      return;
    }
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Recording is not supported in this browser.");
      setPermission("denied");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Covers a refused prompt, a blocked origin, and "no input device".
      setError("Microphone access was denied.");
      setPermission("denied");
      return;
    }
    setPermission("granted");
    streamRef.current = stream;

    const mimeType = pickRecorderMimeType((type) =>
      MediaRecorder.isTypeSupported(type)
    );
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      // Revoke the previous take's URL before minting the new one, so a long
      // session of re-recordings never accumulates object URLs.
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const elapsed = Date.now() - startedAtRef.current - pausedMsRef.current;
      const next: Recording = {
        blob,
        durationMs: Math.max(0, elapsed),
        mimeType: type,
        url,
      };
      setRecording(next);
      setDurationMs(next.durationMs);
      onStopRef.current?.(next);
      teardown();
      setIsRecording(false);
      setIsPaused(false);
    });

    // Tap the mic for metering — the analyser is a listener on the stream, not
    // in any playback path, so nothing is routed back to the speakers.
    const ctx = webAudio.getContext();
    if (ctx) {
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = ANALYSER_FFT_SIZE;
      source.connect(node);
      sourceRef.current = source;
      setAnalyser(node);
    }

    startedAtRef.current = Date.now();
    pausedMsRef.current = 0;
    setDurationMs(0);
    recorder.start();
    setIsRecording(true);
    setIsPaused(false);
    tickRef.current = window.setInterval(() => {
      setDurationMs(Date.now() - startedAtRef.current - pausedMsRef.current);
    }, DURATION_TICK_MS);
  }, [teardown, webAudio]);

  const stop = useCallback(() => {
    // The "stop" listener builds the blob and tears the graph down.
    recorderRef.current?.stop();
  }, []);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "recording") {
      return;
    }
    recorder.pause();
    pausedAtRef.current = Date.now();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "paused") {
      return;
    }
    // Paused time is excluded from the duration, so the readout matches the
    // audio actually captured.
    pausedMsRef.current += Date.now() - pausedAtRef.current;
    recorder.resume();
    setIsPaused(false);
  }, []);

  useEffect(
    () => () => {
      teardown();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    },
    [teardown]
  );

  return {
    analyser,
    clear,
    durationMs,
    error,
    isPaused,
    isRecording,
    pause,
    permission,
    recording,
    resume,
    start,
    stop,
  };
}
