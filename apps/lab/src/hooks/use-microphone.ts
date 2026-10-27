"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  silentMicrophone,
  useAudioSession,
} from "@/hooks/use-audio-session";
import { webAudio } from "@/lib/web-audio";

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
  }, []);

  useEffect(() => stop, [stop]);

  return { analyser, error, isListening: analyser !== null, start, stop };
}

const OFF = { error: null, on: false };

/**
 * The microphone switch of the nearest session: a button in its bar flips it,
 * and every component inside the session that listens with
 * `usePageMicrophone` follows. It holds no audio, only whether the microphone
 * should be on. Outside a session it stays off and does nothing.
 */
export function useMicrophoneSwitch() {
  const microphone = useAudioSession()?.microphone ?? silentMicrophone;
  const { error, on } = useSyncExternalStore(
    microphone.subscribe,
    microphone.get,
    () => OFF
  );
  const toggle = useCallback(
    () => microphone.set({ error: null, on: !microphone.get().on }),
    [microphone]
  );
  const fail = useCallback(
    (message: string) => microphone.set({ error: message, on: false }),
    [microphone]
  );
  return {
    attach: microphone.attach,
    error,
    fail,
    on,
    setOn: microphone.setOn,
    toggle,
  };
}

/**
 * The microphone while the session's switch is on, as an `AnalyserNode` to
 * read (`null` while it is off). A preview's bar flips the switch, so a demo
 * can leave its listen button to its host. A refused microphone puts the
 * switch back off and says why.
 */
export function usePageMicrophone() {
  const { fail, on } = useMicrophoneSwitch();
  const { analyser, error, start, stop } = useMicrophone();
  useEffect(() => {
    if (on) {
      start();
    } else {
      stop();
    }
  }, [on, start, stop]);
  useEffect(() => {
    if (error) {
      fail(error);
    }
  }, [error, fail]);
  return analyser;
}