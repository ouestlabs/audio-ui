"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

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

const switchListeners = new Set<() => void>();
interface SwitchState {
  error: string | null;
  on: boolean;
}

let switchState: SwitchState = { error: null, on: false };

function subscribeSwitch(listener: () => void) {
  switchListeners.add(listener);
  return () => {
    switchListeners.delete(listener);
  };
}

function setSwitch(next: Partial<SwitchState>) {
  switchState = { ...switchState, ...next };
  for (const listener of switchListeners) {
    listener();
  }
}

const getSwitch = () => switchState;
const serverSwitch: SwitchState = { error: null, on: false };
const getServerSwitch = () => serverSwitch;
const setOn = (next: boolean) => setSwitch({ on: next });
const toggleSwitch = () => setSwitch({ error: null, on: !switchState.on });

/**
 * The page's microphone switch: a button anywhere on the page flips it, and
 * every component that listens with `usePageMicrophone` follows. It holds no
 * audio, only whether the microphone should be on.
 */
export function useMicrophoneSwitch() {
  const { error, on } = useSyncExternalStore(
    subscribeSwitch,
    getSwitch,
    getServerSwitch
  );
  return { error, on, setOn, toggle: toggleSwitch };
}

/**
 * The microphone while the page's switch is on, as an `AnalyserNode` to read
 * (`null` while it is off). A preview's bar flips the switch, so a demo can
 * leave its listen button to the page. A refused microphone puts the switch
 * back off and says why.
 */
export function usePageMicrophone() {
  const { on } = useMicrophoneSwitch();
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
      setSwitch({ error, on: false });
    }
  }, [error]);
  return analyser;
}
