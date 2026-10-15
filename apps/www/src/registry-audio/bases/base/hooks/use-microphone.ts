"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";

const ANALYSER_FFT_SIZE = 4096;

export interface UseMicrophoneReturn {
  /** Taps the microphone's signal while it listens: read it, never connect it to the speakers. `null` otherwise. */
  analyser: AnalyserNode | null;
  error: string | null;
  isListening: boolean;
  /** Asks for the microphone and starts listening. Call it from a user gesture: the browser asks for permission and a suspended context resumes. */
  start: () => Promise<void>;
  /** Releases the microphone. */
  stop: () => void;
}

/**
 * The microphone as an `AnalyserNode` on the shared AudioContext. The signal
 * is raw: echo cancellation, noise suppression and automatic gain are what a
 * call needs and what flattens a tuner or a meter. The analyser is not
 * connected to the destination, so the microphone never plays out of the
 * speakers. The microphone is released on `stop` and on unmount.
 */
export function useMicrophone(): UseMicrophoneReturn {
  const webAudio = useWebAudio();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    setAnalyser(null);
  }, []);

  const start = useCallback(async () => {
    const ctx = webAudio.getContext();
    if (!(ctx && navigator.mediaDevices?.getUserMedia)) {
      setError("This browser has no microphone access.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
      streamRef.current = stream;
      const node = ctx.createAnalyser();
      node.fftSize = ANALYSER_FFT_SIZE;
      ctx.createMediaStreamSource(stream).connect(node);
      setError(null);
      setAnalyser(node);
    } catch {
      setError("Microphone access was denied.");
    }
  }, [webAudio]);

  useEffect(() => stop, [stop]);

  return { analyser, error, isListening: analyser !== null, start, stop };
}
