"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

/** A value others can follow, in the shape `useSyncExternalStore` takes. */
function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<T>) => {
      state = { ...state, ...patch };
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A switch with an `on` state: it turns off when the last control showing it goes. */
function createSwitch<T extends { on: boolean }>(initial: T) {
  const store = createStore(initial);
  let controls = 0;
  return {
    ...store,
    /** Counts a control showing the switch, such as a button in a bar. Returns how to let go. */
    attach: () => {
      controls += 1;
      return () => {
        controls -= 1;
        if (controls === 0) {
          store.set({ on: false } as Partial<T>);
        }
      };
    },
    setOn: (on: boolean) => store.set({ on } as Partial<T>),
    toggle: () => store.set({ on: !store.get().on } as Partial<T>),
  };
}

/** A switch that does nothing and stays off: what a component reads when there is no session around it. */
function createSilentSwitch<T extends { on: boolean }>(initial: T) {
  const noop = () => undefined;
  return {
    attach: () => noop,
    get: () => initial,
    set: (_patch: Partial<T>) => undefined,
    setOn: (_on: boolean) => undefined,
    subscribe: () => noop,
    toggle: noop,
  };
}

export type PlayState = { on: boolean };
export type MicrophoneState = { error: string | null; on: boolean };

export const silentPlay = createSilentSwitch<PlayState>({ on: false });
export const silentMicrophone = createSilentSwitch<MicrophoneState>({
  error: null,
  on: false,
});

/**
 * What one preview shares between its bar and the demo it shows: whether the
 * sound should play and whether the microphone should listen. It holds no
 * audio, only the two switches, so two sessions never touch each other.
 */
export interface AudioSession {
  microphone: ReturnType<typeof createSwitch<MicrophoneState>>;
  play: ReturnType<typeof createSwitch<PlayState>>;
}

export function createAudioSession(): AudioSession {
  return {
    microphone: createSwitch<MicrophoneState>({ error: null, on: false }),
    play: createSwitch<PlayState>({ on: false }),
  };
}

const AudioSessionContext = createContext<AudioSession | null>(null);

/**
 * Gives what is inside it a session of its own: a play switch and a
 * microphone switch that nothing outside it follows. Put one around a demo
 * and its controls to let a button turn the demo's sound on.
 */
export function AudioSessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(createAudioSession);
  return (
    <AudioSessionContext.Provider value={session}>
      {children}
    </AudioSessionContext.Provider>
  );
}

/** The nearest session, or nothing when the component is not inside one. */
export function useAudioSession() {
  return useContext(AudioSessionContext);
}
